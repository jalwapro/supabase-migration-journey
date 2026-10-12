-- Complete legacy balance audit: snapshot existing balances and journal future profile/inventory mutations.
alter table public.coin_economy_entries drop constraint if exists coin_economy_entries_account_type_check;
alter table public.coin_economy_entries add constraint coin_economy_entries_account_type_check
  check (account_type in ('user_wallet','seller_inventory','treasury','coin_mint','platform_clearing','withdrawal_escrow','coin_burn'));

create or replace function public.coin_economy_audit_profile_coins()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_delta bigint; v_operation text; v_tx uuid; v_key text;
begin
  v_delta:=new.coins-old.coins;
  if v_delta<>0 then
    v_operation:=coalesce(nullif(current_setting('app.coin_operation',true),''),'');
    insert into public.coin_economy_balance_events(database_transaction_id,account_type,account_id,delta,balance_after,actor_id,operation)
      values(txid_current(),'user_wallet',new.id,v_delta,new.coins,auth.uid(),nullif(v_operation,''));
    if v_operation not in ('seller_transfer','user_p2p_transfer','inventory_allocation') then
      v_key:='auto:'||txid_current()::text||':wallet:'||new.id::text||':'||gen_random_uuid()::text;
      insert into public.coin_economy_transactions(actor_id,request_key,kind,status,reference_type,metadata,completed_at)
        values(auth.uid(),v_key,'automatic_balance_change','posted','profile_balance_change',
          jsonb_build_object('operation',v_operation,'user_id',new.id,'delta',v_delta,'balance_after',new.coins),now())
        returning id into v_tx;
      insert into public.coin_economy_entries(transaction_id,account_type,account_id,amount,balance_after)
        values(v_tx,'user_wallet',new.id,v_delta,new.coins),(v_tx,'platform_clearing',null,-v_delta,null);
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists coin_economy_audit_profile_coins_trg on public.profiles;
create trigger coin_economy_audit_profile_coins_trg after update of coins on public.profiles
for each row execute function public.coin_economy_audit_profile_coins();

create or replace function public.coin_economy_audit_seller_inventory()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_delta bigint; v_operation text; v_tx uuid; v_key text;
begin
  v_delta:=new.available_coins-old.available_coins;
  if v_delta<>0 then
    v_operation:=coalesce(nullif(current_setting('app.coin_operation',true),''),'');
    insert into public.coin_economy_balance_events(database_transaction_id,account_type,account_id,delta,balance_after,actor_id,operation)
      values(txid_current(),'seller_inventory',new.seller_id,v_delta,new.available_coins,auth.uid(),nullif(v_operation,''));
    if v_operation not in ('seller_transfer','inventory_allocation') then
      v_key:='auto:'||txid_current()::text||':inventory:'||new.seller_id::text||':'||gen_random_uuid()::text;
      insert into public.coin_economy_transactions(actor_id,request_key,kind,status,reference_type,metadata,completed_at)
        values(auth.uid(),v_key,'automatic_balance_change','posted','seller_inventory_change',
          jsonb_build_object('seller_id',new.seller_id,'delta',v_delta,'balance_after',new.available_coins,'operation',v_operation),now())
        returning id into v_tx;
      insert into public.coin_economy_entries(transaction_id,account_type,account_id,amount,balance_after)
        values(v_tx,'seller_inventory',new.seller_id,v_delta,new.available_coins),(v_tx,'platform_clearing',null,-v_delta,null);
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists coin_economy_audit_seller_inventory_trg on public.coin_seller_inventory;
create trigger coin_economy_audit_seller_inventory_trg after update of available_coins on public.coin_seller_inventory
for each row execute function public.coin_economy_audit_seller_inventory();

create or replace function public.coin_inventory_request_action(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=auth.uid(); v_req public.coin_inventory_requests%rowtype; v_seller public.coin_sellers%rowtype;
  v_amount bigint; v_balance bigint; v_treasury_balance bigint; v_tx uuid; v_is_admin boolean;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  v_is_admin:=public.is_admin(v_actor);
  if p_action='REQUEST' then
    v_amount:=nullif(p_payload->>'requested_amount','')::bigint;
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
    v_amount:=coalesce(nullif(p_payload->>'approved_amount','')::bigint,v_req.requested_amount);
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
    perform set_config('app.coin_operation','inventory_allocation',true);
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

do $$
declare v_tx uuid; v_total numeric; v_profile_count bigint; v_inventory_count bigint;
begin
  if not exists(select 1 from public.coin_economy_transactions where kind='legacy_opening_balance') then
    select coalesce(sum(coins),0),count(*) filter(where coins>0) into v_total,v_profile_count from public.profiles where coins>0;
    select v_total+coalesce(sum(available_coins),0),count(*) filter(where available_coins>0)
      into v_total,v_inventory_count from public.coin_seller_inventory;
    insert into public.coin_economy_transactions(kind,status,reference_type,metadata,completed_at)
      values('legacy_opening_balance','posted','migration',jsonb_build_object('profile_wallets',v_profile_count,
        'seller_inventories',v_inventory_count,'opening_coin_total',v_total,'snapshot_at',now()),now()) returning id into v_tx;
    insert into public.coin_economy_entries(transaction_id,account_type,account_id,amount,balance_after)
      select v_tx,'user_wallet',id,coins,coins from public.profiles where coins>0;
    insert into public.coin_economy_entries(transaction_id,account_type,account_id,amount,balance_after)
      select v_tx,'seller_inventory',seller_id,available_coins,available_coins from public.coin_seller_inventory where available_coins>0;
    if v_total>0 then insert into public.coin_economy_entries(transaction_id,account_type,account_id,amount,balance_after)
      values(v_tx,'coin_mint',null,-v_total::bigint,null); end if;
  end if;
end $$;
