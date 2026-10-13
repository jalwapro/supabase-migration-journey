-- JALWA P2P agency rule hardening.
-- Keeps the P2P wallet as the only authoritative balance for this workspace.
begin;

alter type public.p2p_ledger_kind add value if not exists 'agent_settlement';

alter table public.p2p_market_settings
  add column if not exists admin_bulk_min_coins bigint not null default 10000000
  check (admin_bulk_min_coins >= 1000000);

create or replace function public.p2p_admin_set_bulk_threshold(p_min_coins bigint)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if (select p2p_private.current_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_min_coins is null or p_min_coins<1000000 then raise exception 'BULK_THRESHOLD_TOO_LOW'; end if;
  update public.p2p_market_settings set admin_bulk_min_coins=p_min_coins,updated_at=now() where singleton=true;
  if not found then raise exception 'MARKET_SETTINGS_NOT_FOUND'; end if;
end $$;
revoke all on function public.p2p_admin_set_bulk_threshold(bigint) from public,anon;
grant execute on function public.p2p_admin_set_bulk_threshold(bigint) to authenticated;

-- Country/currency is assigned by Admin to both Super Agents and Sub-Agents.
create or replace function public.p2p_admin_set_agent_location(p_agent_id uuid,p_country_code text,p_currency_code text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_market public.p2p_market_settings%rowtype; v_role public.p2p_role;
begin
  if (select p2p_private.current_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_country_code !~ '^[A-Z]{2}$' or p_currency_code !~ '^[A-Z]{3}$' then raise exception 'INVALID_AGENT_LOCATION'; end if;
  select role into v_role from public.p2p_profiles where user_id=p_agent_id and active and role in ('super_agent','sub_agent');
  if not found then raise exception 'ACTIVE_AGENT_REQUIRED'; end if;
  select * into v_market from public.p2p_market_settings where singleton=true and active;
  if not found then raise exception 'MARKET_DISABLED'; end if;
  if not exists(select 1 from public.p2p_coin_fiat_rates where currency_code=p_currency_code and active) then raise exception 'COIN_FIAT_RATE_UNAVAILABLE'; end if;
  insert into public.p2p_agent_settings(agent_id,country_code,currency_code,coins_per_bundle,payment_methods,payment_details,min_order_coins,max_order_coins,is_listed)
  values(p_agent_id,p_country_code,p_currency_code,v_market.min_agent_coins_per_bundle,array['JazzCash']::text[],'{}'::jsonb,500,100000,false)
  on conflict(agent_id) do update set country_code=excluded.country_code,currency_code=excluded.currency_code,is_listed=false,updated_at=now();
end $$;
revoke all on function public.p2p_admin_set_agent_location(uuid,text,text) from public,anon;
grant execute on function public.p2p_admin_set_agent_location(uuid,text,text) to authenticated;

-- Transfers are internal stock movements after off-platform payment is verified.
-- Direct Admin -> Sub-Agent is wholesale-only (default 10 million coins).
create or replace function public.p2p_transfer_coins(p_request_key uuid,p_to_user_id uuid,p_amount bigint)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_from_role public.p2p_role;
  v_to_role public.p2p_role;
  v_to_super uuid;
  v_id uuid;
  v_bulk_min bigint;
  v_existing public.p2p_ledger%rowtype;
begin
  if v_actor is null or p_request_key is null or p_to_user_id is null or p_amount is null or p_amount<=0 then raise exception 'INVALID_TRANSFER'; end if;
  select * into v_existing from public.p2p_ledger where request_key=p_request_key;
  if found then
    if v_existing.actor_id=v_actor and v_existing.to_user_id=p_to_user_id and v_existing.asset='coin' and v_existing.kind='coin_transfer' and v_existing.amount=p_amount then return v_existing.id; end if;
    raise exception 'IDEMPOTENCY_KEY_REUSED';
  end if;
  select role into v_from_role from public.p2p_profiles where user_id=v_actor and active;
  select role,super_agent_id into v_to_role,v_to_super from public.p2p_profiles where user_id=p_to_user_id and active;
  if v_from_role is null or v_to_role is null or v_actor=p_to_user_id then raise exception 'INVALID_PARTIES'; end if;
  if not (
    (v_from_role='admin' and v_to_role='super_agent')
    or (v_from_role='super_agent' and v_to_role='sub_agent' and v_to_super=v_actor)
    or (v_from_role='sub_agent' and v_to_role='user')
    or (v_from_role='admin' and v_to_role='sub_agent' and p_amount >= (select admin_bulk_min_coins from public.p2p_market_settings where singleton=true))
  ) then raise exception 'HIERARCHY_TRANSFER_FORBIDDEN'; end if;
  if v_from_role='admin' and v_to_role='sub_agent' then
    select admin_bulk_min_coins into v_bulk_min from public.p2p_market_settings where singleton=true;
    if v_bulk_min is null or p_amount<v_bulk_min then raise exception 'ADMIN_DIRECT_AGENT_TRANSFER_REQUIRES_BULK'; end if;
  end if;
  perform 1 from public.p2p_wallets where user_id in (v_actor,p_to_user_id) order by user_id for update;
  update public.p2p_wallets set coin_available=coin_available-p_amount,updated_at=now() where user_id=v_actor and coin_available>=p_amount;
  if not found then raise exception 'INSUFFICIENT_COINS'; end if;
  update public.p2p_wallets set coin_available=coin_available+p_amount,updated_at=now() where user_id=p_to_user_id;
  if not found then raise exception 'RECIPIENT_WALLET_NOT_FOUND'; end if;
  insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,to_user_id,actor_id,metadata)
  values(p_request_key,'coin_transfer','coin',p_amount,v_actor,p_to_user_id,v_actor,
    jsonb_build_object('transfer_path',v_from_role::text||'_to_'||v_to_role::text,'wholesale',v_from_role='admin' and v_to_role='sub_agent'))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.p2p_transfer_coins(uuid,uuid,bigint) from public,anon;
grant execute on function public.p2p_transfer_coins(uuid,uuid,bigint) to authenticated;

commit;
