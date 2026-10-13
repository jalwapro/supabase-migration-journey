-- Cash settlement quotes use the configured diamond/fiat exchange rate.
begin;
alter table public.p2p_agent_settlements add column if not exists fiat_amount numeric(20,2) check(fiat_amount is null or fiat_amount>0);
create or replace function public.p2p_request_agent_settlement(
  p_request_key uuid,p_diamond_amount bigint,p_settlement_type text,
  p_coin_amount bigint default null,p_fiat_currency text default null,p_admin_recipient_id uuid default null
) returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_role public.p2p_role;
  v_parent uuid;
  v_recipient uuid;
  v_id uuid;
  v_rate numeric(20,8);
  v_fiat numeric(20,2);
  v_old public.p2p_agent_settlements%rowtype;
begin
  if v_actor is null or p_request_key is null or p_diamond_amount is null or p_diamond_amount<=0 then raise exception 'INVALID_SETTLEMENT_REQUEST'; end if;
  if p_settlement_type not in ('cash','coins') then raise exception 'INVALID_SETTLEMENT_TYPE'; end if;
  if p_settlement_type='coins' and (p_coin_amount is null or p_coin_amount<=0) then raise exception 'COIN_AMOUNT_REQUIRED'; end if;
  if p_settlement_type='cash' and coalesce(p_coin_amount,0)<>0 then raise exception 'CASH_SETTLEMENT_CANNOT_INCLUDE_COINS'; end if;
  if p_settlement_type='cash' then
    if p_fiat_currency is null or p_fiat_currency !~ '^[A-Z]{3}
  select * into v_old from public.p2p_agent_settlements where request_key=p_request_key;
  if found then
    if v_old.from_user_id=v_actor then return v_old.id; end if;
    raise exception 'IDEMPOTENCY_KEY_REUSED';
  end if;
  select role,super_agent_id into v_role,v_parent from public.p2p_profiles where user_id=v_actor and active;
  if v_role='sub_agent' then
    v_recipient:=v_parent;
    if v_recipient is null or not exists(select 1 from public.p2p_profiles where user_id=v_recipient and role='super_agent' and active) then raise exception 'ACTIVE_PARENT_SUPER_AGENT_REQUIRED'; end if;
  elsif v_role='super_agent' then
    v_recipient:=p_admin_recipient_id;
    if v_recipient is null or not exists(select 1 from public.p2p_profiles where user_id=v_recipient and role='admin' and active) then raise exception 'ACTIVE_ADMIN_RECIPIENT_REQUIRED'; end if;
  else
    raise exception 'AGENT_ROLE_REQUIRED';
  end if;
  if v_recipient=v_actor then raise exception 'INVALID_SETTLEMENT_PARTIES'; end if;
  perform 1 from public.p2p_wallets where user_id=v_actor for update;
  update public.p2p_wallets set diamond_available=diamond_available-p_diamond_amount,diamond_locked=diamond_locked+p_diamond_amount,updated_at=now()
    where user_id=v_actor and diamond_available>=p_diamond_amount;
  if not found then raise exception 'INSUFFICIENT_DIAMONDS'; end if;
  insert into public.p2p_agent_settlements(request_key,from_user_id,to_user_id,settlement_type,diamond_amount,coin_amount,fiat_currency,fiat_amount)
  values(p_request_key,v_actor,v_recipient,p_settlement_type,p_diamond_amount,nullif(p_coin_amount,0),p_fiat_currency,v_fiat)
  returning id into v_id;
  insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,to_user_id,actor_id,metadata,settlement_id)
  values(p_request_key,'agent_settlement','diamond',p_diamond_amount,v_actor,v_recipient,v_actor,
    jsonb_build_object('stage','locked','settlement_type',p_settlement_type,'coin_amount',nullif(p_coin_amount,0),'fiat_currency',p_fiat_currency,'fiat_amount',v_fiat),v_id);
  insert into public.p2p_notifications(recipient_id,event_type,payload)
  values(v_recipient,'agent_settlement_pending',jsonb_build_object('settlement_id',v_id,'from_user_id',v_actor,'diamond_amount',p_diamond_amount,'settlement_type',p_settlement_type));
  return v_id;
end $$;
 then raise exception 'CASH_CURRENCY_REQUIRED'; end if;
    select diamonds_per_fiat_unit into v_rate from public.p2p_exchange_rates where currency_code=p_fiat_currency and active;
    if v_rate is null then raise exception 'EXCHANGE_RATE_UNAVAILABLE'; end if;
    v_fiat:=round(p_diamond_amount::numeric/v_rate,2);
    if v_fiat<=0 then raise exception 'SETTLEMENT_BELOW_MINIMUM_FIAT'; end if;
  elsif p_fiat_currency is not null then raise exception 'CURRENCY_ONLY_FOR_CASH_SETTLEMENT'; end if;
  select * into v_old from public.p2p_agent_settlements where request_key=p_request_key;
  if found then
    if v_old.from_user_id=v_actor then return v_old.id; end if;
    raise exception 'IDEMPOTENCY_KEY_REUSED';
  end if;
  select role,super_agent_id into v_role,v_parent from public.p2p_profiles where user_id=v_actor and active;
  if v_role='sub_agent' then
    v_recipient:=v_parent;
    if v_recipient is null or not exists(select 1 from public.p2p_profiles where user_id=v_recipient and role='super_agent' and active) then raise exception 'ACTIVE_PARENT_SUPER_AGENT_REQUIRED'; end if;
  elsif v_role='super_agent' then
    v_recipient:=p_admin_recipient_id;
    if v_recipient is null or not exists(select 1 from public.p2p_profiles where user_id=v_recipient and role='admin' and active) then raise exception 'ACTIVE_ADMIN_RECIPIENT_REQUIRED'; end if;
  else
    raise exception 'AGENT_ROLE_REQUIRED';
  end if;
  if v_recipient=v_actor then raise exception 'INVALID_SETTLEMENT_PARTIES'; end if;
  perform 1 from public.p2p_wallets where user_id=v_actor for update;
  update public.p2p_wallets set diamond_available=diamond_available-p_diamond_amount,diamond_locked=diamond_locked+p_diamond_amount,updated_at=now()
    where user_id=v_actor and diamond_available>=p_diamond_amount;
  if not found then raise exception 'INSUFFICIENT_DIAMONDS'; end if;
  insert into public.p2p_agent_settlements(request_key,from_user_id,to_user_id,settlement_type,diamond_amount,coin_amount,fiat_currency)
  values(p_request_key,v_actor,v_recipient,p_settlement_type,p_diamond_amount,nullif(p_coin_amount,0),p_fiat_currency)
  returning id into v_id;
  insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,to_user_id,actor_id,metadata,settlement_id)
  values(p_request_key,'agent_settlement','diamond',p_diamond_amount,v_actor,v_recipient,v_actor,
    jsonb_build_object('stage','locked','settlement_type',p_settlement_type,'coin_amount',nullif(p_coin_amount,0),'fiat_currency',p_fiat_currency),v_id);
  insert into public.p2p_notifications(recipient_id,event_type,payload)
  values(v_recipient,'agent_settlement_pending',jsonb_build_object('settlement_id',v_id,'from_user_id',v_actor,'diamond_amount',p_diamond_amount,'settlement_type',p_settlement_type));
  return v_id;
end $$;

revoke all on function public.p2p_request_agent_settlement(uuid,bigint,text,bigint,text,uuid) from public,anon;
grant execute on function public.p2p_request_agent_settlement(uuid,bigint,text,bigint,text,uuid) to authenticated;
commit;
