-- Balance authorized coin issuance in the double-entry journal.
alter table public.coin_economy_entries drop constraint if exists coin_economy_entries_account_type_check;
alter table public.coin_economy_entries add constraint coin_economy_entries_account_type_check
  check (account_type in ('user_wallet','seller_inventory','treasury','coin_mint','withdrawal_escrow','coin_burn'));

create or replace function public.coin_economy_admin_action(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid:=auth.uid(); v_settings public.coin_economy_settings%rowtype; v_coins bigint; v_balance bigint; v_tx uuid; v_super_admin boolean;
begin
  if v_actor is null or not public.is_admin(v_actor) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_action='FUND_TREASURY' then
    select exists(select 1 from public.user_roles where user_id=v_actor and role='super_admin'::public.app_role) into v_super_admin;
    if not v_super_admin then raise exception 'SUPER_ADMIN_REQUIRED_FOR_COIN_ISSUANCE' using errcode='42501'; end if;
    v_coins:=nullif(p_payload->>'coins','')::bigint;
    if v_coins is null or v_coins<=0 or v_coins>1000000000 then raise exception 'INVALID_ISSUANCE_AMOUNT'; end if;
    if length(trim(coalesce(p_payload->>'reason','')))<5 then raise exception 'ISSUANCE_REASON_REQUIRED'; end if;
    update public.coin_economy_treasury set available_coins=available_coins+v_coins,total_issued=total_issued+v_coins,
      updated_by=v_actor,updated_at=now() where id=true returning available_coins into v_balance;
    insert into public.coin_economy_transactions(actor_id,kind,status,reference_type,metadata,completed_at)
      values(v_actor,'treasury_issuance','posted','admin_treasury',jsonb_build_object('coins',v_coins,'balance_after',v_balance,
      'reason',left(p_payload->>'reason',500)),now()) returning id into v_tx;
    insert into public.coin_economy_entries(transaction_id,account_type,account_id,amount,balance_after)
      values(v_tx,'treasury',null,v_coins,v_balance),(v_tx,'coin_mint',null,-v_coins,null);
    insert into public.admin_logs(action,target,details) values('coin_treasury_issued','coin_economy_treasury',
      jsonb_build_object('coins',v_coins,'balance_after',v_balance,'reason',left(p_payload->>'reason',500),'admin_id',v_actor,'transaction_id',v_tx));
    return jsonb_build_object('transaction_id',v_tx,'issued_coins',v_coins,'treasury_balance',v_balance);
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
