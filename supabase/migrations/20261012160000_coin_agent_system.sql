-- JALWA Coin Agent: separate diamond sources, user payouts, agent ledger and manual admin settlement.
create extension if not exists pgcrypto;

create table if not exists public.coin_agent_config (
  id boolean primary key default true check (id),
  min_user_buy_rate_pkr_per_1000 numeric(12,2) not null default 100 check (min_user_buy_rate_pkr_per_1000 > 0),
  max_user_buy_rate_pkr_per_1000 numeric(12,2) not null default 1000 check (max_user_buy_rate_pkr_per_1000 >= min_user_buy_rate_pkr_per_1000),
  min_direct_admin_diamonds bigint not null default 50000 check (min_direct_admin_diamonds >= 50000),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.coin_agent_config(id) values(true) on conflict(id) do nothing;

alter table public.agent_profiles
  add column if not exists coin_agent_enabled boolean not null default false,
  add column if not exists diamond_buy_rate_pkr_per_1000 numeric(12,2);

create table if not exists public.coin_agent_rate_tiers (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_profiles(user_id) on delete cascade,
  tier_type text not null check (tier_type in ('coin_purchase','diamond_exchange')),
  source_type text check (source_type in ('profile_diamonds','red_diamonds')),
  min_quantity bigint not null default 1 check (min_quantity > 0),
  max_quantity bigint check (max_quantity is null or max_quantity >= min_quantity),
  coin_package bigint,
  price_pkr numeric(14,2),
  coins_per_1000_diamonds numeric(14,2),
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coin_agent_tier_shape check (
    (tier_type='coin_purchase' and source_type is null and coin_package is not null and coin_package > 0 and price_pkr is not null and price_pkr > 0 and coins_per_1000_diamonds is null)
    or
    (tier_type='diamond_exchange' and source_type is not null and coin_package is null and price_pkr is null and coins_per_1000_diamonds is not null and coins_per_1000_diamonds > 0)
  )
);
create index if not exists coin_agent_rate_tiers_lookup on public.coin_agent_rate_tiers(agent_id,tier_type,source_type,is_active,min_quantity);

create table if not exists public.coin_agent_balances (
  agent_id uuid not null references public.agent_profiles(user_id) on delete cascade,
  source_type text not null check (source_type in ('profile_diamonds','red_diamonds')),
  available_diamonds bigint not null default 0 check (available_diamonds >= 0),
  total_acquired_diamonds bigint not null default 0 check (total_acquired_diamonds >= 0),
  total_settled_diamonds bigint not null default 0 check (total_settled_diamonds >= 0),
  updated_at timestamptz not null default now(),
  primary key(agent_id,source_type)
);

create table if not exists public.coin_agent_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  agent_id uuid not null references public.agent_profiles(user_id) on delete restrict,
  source_type text not null check (source_type in ('profile_diamonds','red_diamonds')),
  diamonds bigint not null check (diamonds > 0),
  rate_pkr_per_1000 numeric(12,2) not null check (rate_pkr_per_1000 > 0),
  payout_pkr numeric(14,2) not null check (payout_pkr > 0),
  payout_method text not null check (payout_method in ('jazzcash','easypaisa','bank','other')),
  payout_account_name text not null,
  payout_account_number text not null,
  payment_reference text,
  payment_note text,
  status text not null default 'pending_payment' check (status in ('pending_payment','paid','completed','cancelled','disputed')),
  agent_marked_paid_at timestamptz,
  user_confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(user_id <> agent_id)
);
create index if not exists coin_agent_trades_user on public.coin_agent_trades(user_id,created_at desc);
create index if not exists coin_agent_trades_agent on public.coin_agent_trades(agent_id,status,created_at desc);

create table if not exists public.coin_agent_ledger (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid references public.coin_agent_trades(id) on delete restrict,
  settlement_id uuid,
  agent_id uuid not null references public.agent_profiles(user_id) on delete restrict,
  source_type text not null check (source_type in ('profile_diamonds','red_diamonds')),
  entry_type text not null check (entry_type in ('trade_acquired','settlement_reserved','settlement_approved','settlement_rejected','trade_refund','admin_adjustment')),
  diamond_delta bigint not null,
  balance_after bigint not null check (balance_after >= 0),
  note text not null,
  created_at timestamptz not null default now(),
  check (trade_id is not null or settlement_id is not null or entry_type='admin_adjustment')
);
create index if not exists coin_agent_ledger_agent on public.coin_agent_ledger(agent_id,source_type,created_at desc);

create table if not exists public.coin_agent_settlements (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_profiles(user_id) on delete restrict,
  source_type text not null check (source_type in ('profile_diamonds','red_diamonds')),
  diamonds bigint not null check (diamonds > 0),
  coins_to_credit bigint not null check (coins_to_credit > 0),
  exchange_rate_coins_per_1000 numeric(14,2) not null check (exchange_rate_coins_per_1000 > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists coin_agent_settlements_status on public.coin_agent_settlements(status,created_at desc);

alter table public.coin_agent_config enable row level security;
alter table public.coin_agent_rate_tiers enable row level security;
alter table public.coin_agent_balances enable row level security;
alter table public.coin_agent_trades enable row level security;
alter table public.coin_agent_ledger enable row level security;
alter table public.coin_agent_settlements enable row level security;
revoke all on public.coin_agent_config, public.coin_agent_rate_tiers, public.coin_agent_balances, public.coin_agent_trades, public.coin_agent_ledger, public.coin_agent_settlements from anon, authenticated;
grant select on public.coin_agent_rate_tiers, public.coin_agent_balances, public.coin_agent_trades, public.coin_agent_ledger, public.coin_agent_settlements to authenticated;
-- Agent status and enablement are server-managed; clients must use the authenticated Edge RPC.
revoke update on public.agent_profiles from authenticated;

-- All writes go through this authenticated Edge Function -> service-only RPC.
create or replace function public.coin_agent_action(actor_id uuid, action text, payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin boolean := false;
  v_cfg public.coin_agent_config%rowtype;
  v_agent public.agent_profiles%rowtype;
  v_trade public.coin_agent_trades%rowtype;
  v_settle public.coin_agent_settlements%rowtype;
  v_source text;
  v_amount bigint;
  v_rate numeric;
  v_payout numeric;
  v_balance bigint;
  v_coins bigint;
  v_tier public.coin_agent_rate_tiers%rowtype;
  v_id uuid;
  v_status text;
  v_note text;
begin
  if actor_id is null or not exists(select 1 from auth.users where id=actor_id) then raise exception 'AUTH_REQUIRED'; end if;
  v_admin := public.is_admin(actor_id);
  select * into v_cfg from public.coin_agent_config where id=true;
  if not found then raise exception 'COIN_AGENT_CONFIG_MISSING'; end if;

  if action='CONFIG' then
    return jsonb_build_object(
      'config',to_jsonb(v_cfg),
      'agent',(select to_jsonb(a) from public.agent_profiles a where a.user_id=actor_id),
      'balances',coalesce((select jsonb_agg(to_jsonb(b)) from public.coin_agent_balances b where b.agent_id=actor_id),'[]'::jsonb),
      'rates',coalesce((select jsonb_agg(to_jsonb(t)) from public.coin_agent_rate_tiers t where (t.agent_id=actor_id or v_admin) order by t.created_at desc),'[]'::jsonb),
      'trades',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.coin_agent_trades where user_id=actor_id or agent_id=actor_id or v_admin order by created_at desc limit 100) x),'[]'::jsonb),
      'settlements',coalesce((select jsonb_agg(to_jsonb(s)) from (select * from public.coin_agent_settlements where agent_id=actor_id or v_admin order by created_at desc limit 100) s),'[]'::jsonb)
    );
  elsif action='MARKETPLACE' then
    return coalesce((select jsonb_agg(jsonb_build_object('user_id',a.user_id,'country',a.country,'currency_code',a.currency_code,'diamond_buy_rate_pkr_per_1000',a.diamond_buy_rate_pkr_per_1000,'whatsapp_number',a.whatsapp_number))
      from public.agent_profiles a where a.coin_agent_enabled and a.is_active and not a.is_banned and a.diamond_buy_rate_pkr_per_1000 between v_cfg.min_user_buy_rate_pkr_per_1000 and v_cfg.max_user_buy_rate_pkr_per_1000),'[]'::jsonb);
  elsif action='SAVE_AGENT_RATE' then
    v_rate := nullif(payload->>'rate_pkr_per_1000','')::numeric;
    if v_rate is null or v_rate < v_cfg.min_user_buy_rate_pkr_per_1000 or v_rate > v_cfg.max_user_buy_rate_pkr_per_1000 then raise exception 'BUY_RATE_OUT_OF_RANGE:%:%',v_cfg.min_user_buy_rate_pkr_per_1000,v_cfg.max_user_buy_rate_pkr_per_1000; end if;
    update public.agent_profiles set diamond_buy_rate_pkr_per_1000=v_rate, updated_at=now()
      where user_id=actor_id and is_active and not is_banned and coin_agent_enabled returning * into v_agent;
    if not found then raise exception 'AGENT_NOT_ACTIVE_OR_BANNED'; end if;
    return jsonb_build_object('rate',v_rate,'enabled',true);
  elsif action='CREATE_TRADE' then
    v_id := nullif(payload->>'agent_id','')::uuid;
    v_source := payload->>'source_type';
    v_amount := nullif(payload->>'diamonds','')::bigint;
    if v_source not in ('profile_diamonds','red_diamonds') or v_amount is null or v_amount <= 0 or v_amount > 1000000000 then raise exception 'INVALID_DIAMOND_AMOUNT_OR_SOURCE'; end if;
    select * into v_agent from public.agent_profiles where user_id=v_id and coin_agent_enabled and is_active and not is_banned for update;
    if not found or v_id=actor_id or v_agent.diamond_buy_rate_pkr_per_1000 is null then raise exception 'AGENT_NOT_AVAILABLE'; end if;
    if length(trim(coalesce(payload->>'payout_account_name','')))<2 or length(trim(coalesce(payload->>'payout_account_number','')))<5 then raise exception 'PAYOUT_DETAILS_REQUIRED'; end if;
    v_payout := round(v_amount * v_agent.diamond_buy_rate_pkr_per_1000 / 1000,2);
    if v_source='profile_diamonds' then
      update public.profiles set diamonds=diamonds-v_amount,updated_at=now() where id=actor_id and diamonds>=v_amount;
    else
      update public.host_popularity_stats set red_diamonds=red_diamonds-v_amount where host_id=actor_id and red_diamonds>=v_amount;
    end if;
    if not found then raise exception 'INSUFFICIENT_DIAMONDS'; end if;
    insert into public.coin_agent_trades(user_id,agent_id,source_type,diamonds,rate_pkr_per_1000,payout_pkr,payout_method,payout_account_name,payout_account_number)
    values(actor_id,v_id,v_source,v_amount,v_agent.diamond_buy_rate_pkr_per_1000,v_payout,
      coalesce(payload->>'payout_method','jazzcash'),trim(payload->>'payout_account_name'),trim(payload->>'payout_account_number'))
    returning * into v_trade;
    if v_source='profile_diamonds' then
      insert into public.wallet_transactions(user_id,kind,diamonds,diamonds_delta,ref_type,ref_id,note)
      values(actor_id,'coin_agent_trade_hold',-v_amount,-v_amount,'coin_agent_trade',v_trade.id,'Diamonds held pending agent payout');
    end if;
    return to_jsonb(v_trade);
  elsif action='AGENT_MARK_PAID' then
    v_id := nullif(payload->>'trade_id','')::uuid;
    v_note := left(trim(coalesce(payload->>'payment_reference','')),160);
    if v_note='' then raise exception 'PAYMENT_REFERENCE_REQUIRED'; end if;
    update public.coin_agent_trades set status='paid',payment_reference=v_note,payment_note=nullif(left(trim(coalesce(payload->>'payment_note','')),500),''),agent_marked_paid_at=now(),updated_at=now()
      where id=v_id and agent_id=actor_id and status='pending_payment' returning * into v_trade;
    if not found then raise exception 'TRADE_NOT_FOUND_OR_INVALID_STATUS'; end if;
    return to_jsonb(v_trade);
  elsif action='USER_CONFIRM_TRADE' then
    v_id := nullif(payload->>'trade_id','')::uuid;
    select * into v_trade from public.coin_agent_trades where id=v_id for update;
    if not found or v_trade.user_id<>actor_id or v_trade.status<>'paid' then raise exception 'TRADE_NOT_FOUND_OR_NOT_PAID'; end if;
    insert into public.coin_agent_balances(agent_id,source_type,available_diamonds,total_acquired_diamonds)
      values(v_trade.agent_id,v_trade.source_type,v_trade.diamonds,v_trade.diamonds)
      on conflict(agent_id,source_type) do update set available_diamonds=coin_agent_balances.available_diamonds+excluded.available_diamonds,
        total_acquired_diamonds=coin_agent_balances.total_acquired_diamonds+excluded.total_acquired_diamonds,updated_at=now()
      returning available_diamonds into v_balance;
    update public.coin_agent_trades set status='completed',user_confirmed_at=now(),updated_at=now() where id=v_trade.id returning * into v_trade;
    insert into public.coin_agent_ledger(trade_id,agent_id,source_type,entry_type,diamond_delta,balance_after,note)
      values(v_trade.id,v_trade.agent_id,v_trade.source_type,'trade_acquired',v_trade.diamonds,v_balance,'User confirmed agent payout');
    return to_jsonb(v_trade);
  elsif action='CANCEL_TRADE' then
    v_id := nullif(payload->>'trade_id','')::uuid;
    select * into v_trade from public.coin_agent_trades where id=v_id for update;
    if not found or v_trade.status not in ('pending_payment','paid') or (v_trade.user_id<>actor_id and v_trade.agent_id<>actor_id and not v_admin) then raise exception 'TRADE_NOT_CANCELLABLE'; end if;
    if v_trade.status='paid' then raise exception 'PAID_TRADE_MUST_BE_DISPUTED'; end if;
    if v_trade.source_type='profile_diamonds' then
      update public.profiles set diamonds=diamonds+v_trade.diamonds,updated_at=now() where id=v_trade.user_id;
      insert into public.wallet_transactions(user_id,kind,diamonds,diamonds_delta,ref_type,ref_id,note)
        values(v_trade.user_id,'coin_agent_trade_refund',v_trade.diamonds,v_trade.diamonds,'coin_agent_trade',v_trade.id,'Cancelled trade diamond refund');
    else
      update public.host_popularity_stats set red_diamonds=red_diamonds+v_trade.diamonds where host_id=v_trade.user_id;
    end if;
    update public.coin_agent_trades set status='cancelled',cancelled_at=now(),updated_at=now() where id=v_trade.id returning * into v_trade;
    return to_jsonb(v_trade);
  elsif action='SETTLEMENT_REQUEST' then
    v_source := payload->>'source_type';
    v_amount := nullif(payload->>'diamonds','')::bigint;
    if v_source not in ('profile_diamonds','red_diamonds') or v_amount is null or v_amount<=0 then raise exception 'INVALID_SETTLEMENT_AMOUNT'; end if;
    select * into v_agent from public.agent_profiles where user_id=actor_id and coin_agent_enabled and is_active and not is_banned for update;
    if not found then raise exception 'AGENT_NOT_ACTIVE'; end if;
    select * into v_tier from public.coin_agent_rate_tiers where agent_id=actor_id and tier_type='diamond_exchange' and source_type=v_source and is_active and v_amount>=min_quantity and (max_quantity is null or v_amount<=max_quantity) order by min_quantity desc limit 1;
    if not found then raise exception 'NO_EXCHANGE_TIER_FOR_AMOUNT'; end if;
    v_coins := floor((v_amount::numeric/1000)*v_tier.coins_per_1000_diamonds)::bigint;
    if v_coins<=0 then raise exception 'SETTLEMENT_TOO_SMALL'; end if;
    insert into public.coin_agent_balances(agent_id,source_type) values(actor_id,v_source) on conflict do nothing;
    update public.coin_agent_balances set available_diamonds=available_diamonds-v_amount,updated_at=now()
      where agent_id=actor_id and source_type=v_source and available_diamonds>=v_amount returning available_diamonds into v_balance;
    if not found then raise exception 'INSUFFICIENT_AGENT_DIAMONDS'; end if;
    insert into public.coin_agent_settlements(agent_id,source_type,diamonds,coins_to_credit,exchange_rate_coins_per_1000)
      values(actor_id,v_source,v_amount,v_coins,v_tier.coins_per_1000_diamonds) returning * into v_settle;
    insert into public.coin_agent_ledger(settlement_id,agent_id,source_type,entry_type,diamond_delta,balance_after,note)
      values(v_settle.id,actor_id,v_source,'settlement_reserved',-v_amount,v_balance,'Reserved for manual admin settlement');
    return to_jsonb(v_settle);
  elsif action='ADMIN_APPROVE_SETTLEMENT' or action='ADMIN_REJECT_SETTLEMENT' then
    if not v_admin then raise exception 'ADMIN_REQUIRED'; end if;
    v_id := nullif(payload->>'settlement_id','')::uuid;
    select * into v_settle from public.coin_agent_settlements where id=v_id for update;
    if not found or v_settle.status<>'pending' then raise exception 'SETTLEMENT_NOT_PENDING'; end if;
    v_note := nullif(left(trim(coalesce(payload->>'admin_note','')),500),'');
    if action='ADMIN_REJECT_SETTLEMENT' then
      insert into public.coin_agent_balances(agent_id,source_type,available_diamonds) values(v_settle.agent_id,v_settle.source_type,v_settle.diamonds)
        on conflict(agent_id,source_type) do update set available_diamonds=coin_agent_balances.available_diamonds+excluded.available_diamonds,updated_at=now()
        returning available_diamonds into v_balance;
      update public.coin_agent_settlements set status='rejected',admin_note=v_note,reviewed_by=actor_id,reviewed_at=now() where id=v_id returning * into v_settle;
      insert into public.coin_agent_ledger(settlement_id,agent_id,source_type,entry_type,diamond_delta,balance_after,note)
        values(v_id,v_settle.agent_id,v_settle.source_type,'settlement_rejected',v_settle.diamonds,v_balance,coalesce(v_note,'Admin rejected settlement; diamonds returned'));
    else
      if not exists(select 1 from public.coin_sellers where user_id=v_settle.agent_id and is_active) then raise exception 'AGENT_MUST_BE_ACTIVE_COIN_SELLER'; end if;
      insert into public.coin_seller_inventory(seller_id,available_coins,total_allocated,total_sold) values(v_settle.agent_id,0,0,0) on conflict(seller_id) do nothing;
      update public.coin_seller_inventory set available_coins=available_coins+v_settle.coins_to_credit,total_allocated=total_allocated+v_settle.coins_to_credit,updated_at=now()
        where seller_id=v_settle.agent_id returning available_coins into v_coins;
      insert into public.coin_seller_transactions(seller_id,kind,coins,inventory_delta,seller_balance_after,payment_reference,note,created_by)
        values(v_settle.agent_id,'allocation',v_settle.coins_to_credit,v_settle.coins_to_credit,v_coins,'diamond-settlement:'||v_id::text,
          'Manual diamond settlement ('||v_settle.source_type||', '||v_settle.diamonds||' diamonds)',actor_id);
      update public.coin_agent_balances set total_settled_diamonds=total_settled_diamonds+v_settle.diamonds,updated_at=now()
        where agent_id=v_settle.agent_id and source_type=v_settle.source_type returning available_diamonds into v_balance;
      update public.coin_agent_settlements set status='approved',admin_note=v_note,reviewed_by=actor_id,reviewed_at=now() where id=v_id returning * into v_settle;
      insert into public.coin_agent_ledger(settlement_id,agent_id,source_type,entry_type,diamond_delta,balance_after,note)
        values(v_id,v_settle.agent_id,v_settle.source_type,'settlement_approved',0,coalesce(v_balance,0),'Admin approved; coins credited to coin seller inventory');
    end if;
    return to_jsonb(v_settle);
  elsif action='ADMIN_SET_CONFIG' then
    if not v_admin then raise exception 'ADMIN_REQUIRED'; end if;
    update public.coin_agent_config set
      min_user_buy_rate_pkr_per_1000=coalesce(nullif(payload->>'min_rate','')::numeric,min_user_buy_rate_pkr_per_1000),
      max_user_buy_rate_pkr_per_1000=coalesce(nullif(payload->>'max_rate','')::numeric,max_user_buy_rate_pkr_per_1000),
      min_direct_admin_diamonds=coalesce(nullif(payload->>'min_direct_admin_diamonds','')::bigint,min_direct_admin_diamonds),
      updated_by=actor_id,updated_at=now() where id=true returning * into v_cfg;
    if v_cfg.min_user_buy_rate_pkr_per_1000<=0 or v_cfg.max_user_buy_rate_pkr_per_1000<v_cfg.min_user_buy_rate_pkr_per_1000 or v_cfg.min_direct_admin_diamonds<50000 then raise exception 'INVALID_CONFIG'; end if;
    return to_jsonb(v_cfg);
  elsif action='ADMIN_SAVE_TIER' then
    if not v_admin then raise exception 'ADMIN_REQUIRED'; end if;
    v_id := nullif(payload->>'tier_id','')::uuid;
    if coalesce(payload->>'tier_type','') not in ('coin_purchase','diamond_exchange') then raise exception 'INVALID_TIER_TYPE'; end if;
    if payload->>'tier_type'='coin_purchase' then
      insert into public.coin_agent_rate_tiers(agent_id,tier_type,min_quantity,max_quantity,coin_package,price_pkr,created_by)
      values((payload->>'agent_id')::uuid,'coin_purchase',greatest(coalesce(nullif(payload->>'min_quantity','')::bigint,1),1),nullif(payload->>'max_quantity','')::bigint,
        (payload->>'coin_package')::bigint,(payload->>'price_pkr')::numeric,actor_id) returning * into v_tier;
    else
      insert into public.coin_agent_rate_tiers(agent_id,tier_type,source_type,min_quantity,max_quantity,coins_per_1000_diamonds,created_by)
      values((payload->>'agent_id')::uuid,'diamond_exchange',payload->>'source_type',greatest(coalesce(nullif(payload->>'min_quantity','')::bigint,1),1),nullif(payload->>'max_quantity','')::bigint,
        (payload->>'coins_per_1000_diamonds')::numeric,actor_id) returning * into v_tier;
    end if;
    return to_jsonb(v_tier);
  elsif action='ADMIN_TOGGLE_AGENT' then
    if not v_admin then raise exception 'ADMIN_REQUIRED'; end if;
    update public.agent_profiles set coin_agent_enabled=coalesce((payload->>'enabled')::boolean,false),updated_at=now()
      where user_id=(payload->>'agent_id')::uuid and not is_banned returning * into v_agent;
    if not found then raise exception 'AGENT_NOT_FOUND_OR_BANNED'; end if;
    return to_jsonb(v_agent);
  else
    raise exception 'INVALID_ACTION';
  end if;
end;
$$;
revoke all on function public.coin_agent_action(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.coin_agent_action(uuid,text,jsonb) to service_role;

-- Direct-admin withdrawals from the profiles.diamonds wallet must meet the configured threshold.
create or replace function public.request_withdrawal(_diamonds bigint, _method pay_method, _account_number text, _account_name text)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  _uid uuid := auth.uid();
  _rate numeric;
  _amount numeric;
  _id uuid;
  _new_balance bigint;
  _minimum bigint;
begin
  if _uid is null then raise exception 'Sign in to withdraw'; end if;
  select min_direct_admin_diamonds into _minimum from public.coin_agent_config where id=true;
  _minimum := coalesce(_minimum,50000);
  if _diamonds < _minimum then raise exception 'DIRECT_ADMIN_MINIMUM:%',_minimum; end if;
  if _account_number is null or length(btrim(_account_number))=0 or _account_name is null or length(btrim(_account_name))=0 then raise exception 'Account details required'; end if;
  if exists(select 1 from public.profiles where id=_uid and is_free) then raise exception 'Free accounts cannot withdraw'; end if;
  if exists(select 1 from public.withdrawal_requests where user_id=_uid and status='pending') then raise exception 'You already have a pending withdrawal'; end if;
  select diamond_price_pkr into _rate from public.app_settings where id='global';
  _amount := round(_diamonds*coalesce(_rate,0.5),2);
  perform set_config('app.trusted_definer','on',true);
  update public.profiles set diamonds=diamonds-_diamonds,updated_at=now() where id=_uid and diamonds>=_diamonds returning diamonds into _new_balance;
  perform set_config('app.trusted_definer','off',true);
  if _new_balance is null then raise exception 'Not enough diamonds'; end if;
  insert into public.withdrawal_requests(user_id,diamonds,amount_pkr,method,account_number,account_name)
    values(_uid,_diamonds,_amount,_method,btrim(_account_number),btrim(_account_name)) returning id into _id;
  insert into public.wallet_transactions(user_id,kind,diamonds,diamonds_delta,ref_type,ref_id,note)
    values(_uid,'withdraw_hold',-_diamonds,-_diamonds,'withdrawal',_id,'Direct-admin withdrawal requested (held in escrow)');
  return _id;
end;
$$;
revoke all on function public.request_withdrawal(bigint,pay_method,text,text) from public, anon;
grant execute on function public.request_withdrawal(bigint,pay_method,text,text) to authenticated;
