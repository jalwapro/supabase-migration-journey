-- Treasury-backed allocations, feature flags, admin audit, and secure user P2P.
create table if not exists public.coin_economy_treasury (
  id boolean primary key default true check (id),
  available_coins bigint not null default 0 check (available_coins >= 0),
  total_issued bigint not null default 0 check (total_issued >= 0),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.coin_economy_treasury(id) values(true) on conflict(id) do nothing;
alter table public.coin_economy_treasury enable row level security;
drop policy if exists "coin treasury admin read" on public.coin_economy_treasury;
create policy "coin treasury admin read" on public.coin_economy_treasury for select to authenticated using (public.is_admin(auth.uid()));

create or replace function public.coin_inventory_request_action(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := auth.uid(); v_req public.coin_inventory_requests%rowtype; v_seller public.coin_sellers%rowtype;
  v_amount bigint; v_balance bigint; v_treasury_balance bigint; v_tx uuid; v_is_admin boolean;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  v_is_admin := public.is_admin(v_actor);
  if p_action='REQUEST' then
    v_amount := nullif(p_payload->>'requested_amount','')::bigint;
    if v_amount is null or v_amount not between 1 and 1000000000 then raise exception 'INVALID_REQUESTED_AMOUNT'; end if;
    select * into v_seller from public.coin_sellers where user_id=v_actor and is_active for update;
    if not found then raise exception 'ACTIVE_COIN_SELLER_REQUIRED'; end if;
    insert into public.coin_inventory_requests(agent_id,requested_amount,agent_note)
      values(v_actor,v_amount,left(nullif(trim(p_payload->>'note'),''),500)) returning * into v_req;
    return to_jsonb(v_req);
  elsif p_action in ('APPROVE','REJECT') then
    if not v_is_admin then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
    select * into v_req from public.coin_inventory_requests where id=nullif(p_payload->>'request_id','')::uuid for update;
    if not found or v_req.status<>'pending' then raise exception 'REQUEST_NOT_PENDING'; end if;
    if p_action='REJECT' then
      update public.coin_inventory_requests set status='rejected',admin_note=left(nullif(trim(p_payload->>'note'),''),500),reviewed_by=v_actor,reviewed_at=now()
      where id=v_req.id returning * into v_req;
      return to_jsonb(v_req);
    end if;
    v_amount := coalesce(nullif(p_payload->>'approved_amount','')::bigint,v_req.requested_amount);
    if v_amount<1 or v_amount>v_req.requested_amount then raise exception 'INVALID_APPROVED_AMOUNT'; end if;
    select * into v_seller from public.coin_sellers where user_id=v_req.agent_id and is_active for update;
    if not found then raise exception 'SELLER_NO_LONGER_ACTIVE'; end if;
    update public.coin_economy_treasury set available_coins=available_coins-v_amount,updated_by=v_actor,updated_at=now()
      where id=true and available_coins>=v_amount returning available_coins into v_treasury_balance;
    if not found then raise exception 'TREASURY_INSUFFICIENT_INVENTORY'; end if;
    insert into public.coin_economy_transactions(actor_id,kind,status,reference_type,reference_id,metadata)
      values(v_actor,'admin_inventory_allocation','pending','coin_inventory_request',v_req.id,jsonb_build_object('agent_id',v_req.agent_id,'coins',v_amount))
      returning id into v_tx;
    insert into public.coin_seller_inventory(seller_id) values(v_req.agent_id) on conflict(seller_id) do nothing;
    update public.coin_seller_inventory set available_coins=available_coins+v_amount,total_allocated=total_allocated+v_amount,updated_at=now()
      where seller_id=v_req.agent_id returning available_coins into v_balance;
    insert into public.coin_seller_transactions(seller_id,kind,coins,inventory_delta,seller_balance_after,payment_reference,note,created_by)
      values(v_req.agent_id,'allocation',v_amount,v_amount,v_balance,'inventory-request:'||v_req.id::text,'Admin-approved inventory request',v_actor);
    insert into public.coin_economy_entries(transaction_id,account_type,account_id,amount,balance_after)
      values(v_tx,'treasury',null,-v_amount,v_treasury_balance),(v_tx,'seller_inventory',v_req.agent_id,v_amount,v_balance);
    update public.coin_economy_transactions set status='posted',completed_at=now() where id=v_tx;
    update public.coin_inventory_requests set status='approved',approved_amount=v_amount,admin_note=left(nullif(trim(p_payload->>'note'),''),500),
      reviewed_by=v_actor,reviewed_at=now(),transaction_id=v_tx where id=v_req.id returning * into v_req;
    insert into public.admin_logs(action,target,details) values('coin_inventory_request_approved',v_req.id::text,
      jsonb_build_object('agent_id',v_req.agent_id,'coins',v_amount,'transaction_id',v_tx,'admin_id',v_actor));
    return to_jsonb(v_req);
  else raise exception 'UNKNOWN_INVENTORY_ACTION'; end if;
end; $$;
revoke all on function public.coin_inventory_request_action(text,jsonb) from public, anon;
grant execute on function public.coin_inventory_request_action(text,jsonb) to authenticated;

create or replace function public.coin_p2p_transfer(p_recipient_code text,p_coins bigint,p_request_key text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid:=auth.uid(); v_recipient public.profiles%rowtype; v_tx uuid; v_status text; v_meta jsonb; v_input jsonb;
  v_sender_balance bigint; v_recipient_balance bigint; v_settings public.coin_economy_settings%rowtype; v_result jsonb;
  v_code text:=trim(coalesce(p_recipient_code,'')); v_daily bigint;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_coins is null or p_coins<=0 then raise exception 'INVALID_COIN_AMOUNT'; end if;
  if p_request_key !~ '^[A-Za-z0-9:_-]{8,160}$' then raise exception 'VALID_IDEMPOTENCY_KEY_REQUIRED'; end if;
  select * into v_settings from public.coin_economy_settings where id=true;
  if not found or not v_settings.p2p_user_transfers_enabled then raise exception 'USER_TO_USER_TRANSFERS_DISABLED'; end if;
  if p_coins>v_settings.max_p2p_transfer then raise exception 'TRANSFER_LIMIT_EXCEEDED'; end if;
  if v_code='' then raise exception 'RECIPIENT_JALWA_ID_REQUIRED'; end if;
  v_input:=jsonb_build_object('recipient_code',lower(v_code),'coins',p_coins);
  insert into public.coin_economy_transactions(actor_id,request_key,kind,status,reference_type,metadata)
    values(v_actor,p_request_key,'user_p2p_transfer','pending','coin_p2p_transfer',jsonb_build_object('input',v_input))
    on conflict(actor_id,request_key) where request_key is not null do nothing;
  select id,status,metadata into v_tx,v_status,v_meta from public.coin_economy_transactions where actor_id=v_actor and request_key=p_request_key for update;
  if v_meta->'input' is distinct from v_input then raise exception 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'; end if;
  if v_status='posted' then return v_meta->'result'; end if;
  select * into v_recipient from public.profiles where user_code=v_code or lower(username)=lower(v_code)
    order by case when user_code=v_code then 0 else 1 end limit 1 for update;
  if not found or v_recipient.status<>'active' then raise exception 'RECIPIENT_NOT_FOUND_OR_INACTIVE'; end if;
  if v_recipient.id=v_actor then raise exception 'SELF_TRANSFER_NOT_ALLOWED'; end if;
  if exists(select 1 from public.profiles where id=v_actor and status<>'active') then raise exception 'SENDER_NOT_ACTIVE'; end if;
  if coalesce(v_recipient.coins,0)>9000000000000000000-p_coins then raise exception 'RECIPIENT_BALANCE_LIMIT_EXCEEDED'; end if;
  select coalesce(sum(-e.amount),0) into v_daily from public.coin_economy_entries e join public.coin_economy_transactions t on t.id=e.transaction_id
    where t.actor_id=v_actor and t.kind='user_p2p_transfer' and t.status='posted' and t.created_at>=date_trunc('day',now())
      and e.account_type='user_wallet' and e.account_id=v_actor and e.amount<0;
  if v_daily+p_coins>v_settings.daily_p2p_limit then raise exception 'DAILY_TRANSFER_LIMIT_EXCEEDED'; end if;
  perform set_config('app.coin_operation','user_p2p_transfer',true);
  perform set_config('app.trusted_definer','on',true);
  update public.profiles set coins=coins-p_coins,updated_at=now() where id=v_actor and status='active' and coins>=p_coins returning coins into v_sender_balance;
  if not found then raise exception 'INSUFFICIENT_SENDER_BALANCE'; end if;
  update public.profiles set coins=coins+p_coins,updated_at=now() where id=v_recipient.id returning coins into v_recipient_balance;
  perform set_config('app.trusted_definer','off',true);
  insert into public.coin_economy_entries(transaction_id,account_type,account_id,amount,balance_after)
    values(v_tx,'user_wallet',v_actor,-p_coins,v_sender_balance),(v_tx,'user_wallet',v_recipient.id,p_coins,v_recipient_balance);
  insert into public.wallet_transactions(user_id,kind,coins,coins_delta,balance_coins_after,ref_type,ref_id,note)
    values(v_actor,'p2p_sent',p_coins,-p_coins,v_sender_balance,'coin_p2p_transfer',v_tx,'P2P coins sent'),
          (v_recipient.id,'p2p_received',p_coins,p_coins,v_recipient_balance,'coin_p2p_transfer',v_tx,'P2P coins received');
  v_result:=jsonb_build_object('transaction_id',v_tx,'coins_transferred',p_coins,'sender_balance_after',v_sender_balance,
    'recipient_balance_after',v_recipient_balance,'recipient_id',v_recipient.id,'recipient_code',v_recipient.user_code);
  update public.coin_economy_transactions set status='posted',metadata=jsonb_build_object('input',v_input,'result',v_result),completed_at=now() where id=v_tx;
  return v_result;
end; $$;
revoke all on function public.coin_p2p_transfer(text,bigint,text) from public, anon;
grant execute on function public.coin_p2p_transfer(text,bigint,text) to authenticated;

create or replace function public.coin_economy_admin_action(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid:=auth.uid(); v_settings public.coin_economy_settings%rowtype; v_coins bigint; v_balance bigint; v_super_admin boolean;
begin
  if v_actor is null or not public.is_admin(v_actor) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_action='FUND_TREASURY' then
    select exists(select 1 from public.user_roles where user_id=v_actor and role='super_admin'::public.app_role) into v_super_admin;
    if not v_super_admin then raise exception 'SUPER_ADMIN_REQUIRED_FOR_COIN_ISSUANCE' using errcode='42501'; end if;
    v_coins:=nullif(p_payload->>'coins','')::bigint;
    if v_coins is null or v_coins<=0 or v_coins>1000000000 then raise exception 'INVALID_ISSUANCE_AMOUNT'; end if;
    update public.coin_economy_treasury set available_coins=available_coins+v_coins,total_issued=total_issued+v_coins,
      updated_by=v_actor,updated_at=now() where id=true returning available_coins into v_balance;
    insert into public.coin_economy_transactions(actor_id,kind,status,reference_type,metadata,completed_at)
      values(v_actor,'treasury_issuance','posted','admin_treasury',jsonb_build_object('coins',v_coins,'balance_after',v_balance,
      'reason',left(coalesce(p_payload->>'reason',''),500)),now());
    insert into public.admin_logs(action,target,details) values('coin_treasury_issued','coin_economy_treasury',
      jsonb_build_object('coins',v_coins,'balance_after',v_balance,'reason',left(coalesce(p_payload->>'reason',''),500),'admin_id',v_actor));
    return jsonb_build_object('issued_coins',v_coins,'treasury_balance',v_balance);
  elsif p_action='SET_FEATURES' then
    update public.coin_economy_settings set
      p2p_user_transfers_enabled=coalesce((p_payload->>'p2p_user_transfers_enabled')::boolean,p2p_user_transfers_enabled),
      cash_withdrawals_enabled=coalesce((p_payload->>'cash_withdrawals_enabled')::boolean,cash_withdrawals_enabled),
      max_p2p_transfer=coalesce(nullif(p_payload->>'max_p2p_transfer','')::bigint,max_p2p_transfer),
      daily_p2p_limit=coalesce(nullif(p_payload->>'daily_p2p_limit','')::bigint,daily_p2p_limit),
      updated_by=v_actor,updated_at=now() where id=true and
      coalesce(nullif(p_payload->>'max_p2p_transfer','')::bigint,max_p2p_transfer) between 1 and 1000000000 and
      coalesce(nullif(p_payload->>'daily_p2p_limit','')::bigint,daily_p2p_limit) between 1 and 10000000000 returning * into v_settings;
    if not found then raise exception 'INVALID_COIN_ECONOMY_SETTINGS'; end if;
    insert into public.admin_logs(action,target,details) values('coin_economy_settings_updated','coin_economy_settings',to_jsonb(v_settings));
    return to_jsonb(v_settings);
  elsif p_action='OVERVIEW' then
    return jsonb_build_object(
      'settings',(select to_jsonb(s) from public.coin_economy_settings s where id=true),
      'treasury',(select to_jsonb(t) from public.coin_economy_treasury t where id=true),
      'pending_inventory_requests',(select count(*) from public.coin_inventory_requests where status='pending'),
      'pending_withdrawals',(select count(*) from public.coin_withdrawal_requests where status='pending'),
      'posted_transactions',(select count(*) from public.coin_economy_transactions where status='posted'),
      'recent_transactions',(select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]'::jsonb) from
        (select id,actor_id,kind,status,reference_type,reference_id,metadata,created_at from public.coin_economy_transactions order by created_at desc limit 100) t)
    );
  else raise exception 'UNKNOWN_ADMIN_ACTION'; end if;
end; $$;
revoke all on function public.coin_economy_admin_action(text,jsonb) from public, anon;
grant execute on function public.coin_economy_admin_action(text,jsonb) to authenticated;
