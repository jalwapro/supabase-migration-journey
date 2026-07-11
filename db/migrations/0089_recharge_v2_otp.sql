-- ============================================================================
-- Jalwa — Recharge v2: TikTok-style OTP flow
-- 4 coin tiers, 5 payment methods, OTP-based auto credit (mock/demo mode)
-- Real gateway keys plug in later; RPC currently generates & returns OTP.
-- ============================================================================

-- ---------- 1. Coin package tiers ------------------------------------------
do $$ begin
  create type public.coin_tier as enum ('starter','popular','vip','whale');
exception when duplicate_object then null; end $$;

alter table public.coin_packages
  add column if not exists tier public.coin_tier not null default 'starter';

-- Wipe old seed and reseed with 4-tier catalog
delete from public.coin_packages;

insert into public.coin_packages (coins, bonus_coins, price_pkr, label, badge, tier, sort_order, active) values
  -- Starter
  (100,     0,    50,   'Mini',       null,             'starter', 1, true),
  (300,     0,   150,   'Small',      null,             'starter', 2, true),
  (600,    20,   300,   'Basic',      null,             'starter', 3, true),
  (1000,   50,   500,   'Boost',      null,             'starter', 4, true),
  -- Popular
  (5000,   500,  2500,   'Fan',        'Hot',            'popular', 5, true),
  (10000, 1500,  5000,   'Star',       'Most Popular',   'popular', 6, true),
  (15000, 2500,  7500,   'Rising',     null,             'popular', 7, true),
  -- VIP
  (30000,  6000, 15000,   'Elite',      'VIP',            'vip',     8, true),
  (60000, 15000, 30000,   'Royal',      'Best Value',     'vip',     9, true),
  (100000,30000, 50000,   'Legend',     null,             'vip',    10, true),
  -- Whale
  (500000, 200000,  250000,   'Whale',      'Exclusive',      'whale',  11, true),
  (1000000,500000,  500000,   'Emperor',    'Ultimate',       'whale',  12, true);

-- ---------- 2. recharge_orders (OTP flow) ----------------------------------
do $$ begin
  create type public.recharge_order_status as enum ('pending_otp','completed','failed','expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.recharge_pay_method as enum ('jazzcash','easypaisa','bank','card','paypal');
exception when duplicate_object then null; end $$;

create table if not exists public.recharge_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  package_id uuid references public.coin_packages(id) on delete set null,
  method public.recharge_pay_method not null,
  account_ref text not null,             -- phone / card last 4 / paypal email
  amount_pkr numeric(12,2) not null,
  coins_total int not null,
  otp_code text not null,
  otp_expires_at timestamptz not null default (now() + interval '5 minutes'),
  otp_attempts int not null default 0,
  status public.recharge_order_status not null default 'pending_otp',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_recharge_orders_user on public.recharge_orders(user_id, created_at desc);
create index if not exists idx_recharge_orders_status on public.recharge_orders(status);

grant select, insert on public.recharge_orders to authenticated;
grant all on public.recharge_orders to service_role;

alter table public.recharge_orders enable row level security;

drop policy if exists "user reads own orders" on public.recharge_orders;
create policy "user reads own orders" on public.recharge_orders
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "user creates own orders" on public.recharge_orders;
create policy "user creates own orders" on public.recharge_orders
  for insert to authenticated with check (auth.uid() = user_id);

-- ---------- 3. Initiate recharge (returns OTP in demo mode) ----------------
create or replace function public.recharge_initiate(
  _package_id uuid,
  _method public.recharge_pay_method,
  _account_ref text
) returns table (order_id uuid, otp_code text, expires_at timestamptz, amount_pkr numeric, coins_total int)
language plpgsql
security definer
set search_path = public
as $$
declare
  _pkg public.coin_packages%rowtype;
  _otp text;
  _order public.recharge_orders%rowtype;
begin
  if auth.uid() is null then raise exception 'Auth required'; end if;

  select * into _pkg from public.coin_packages where id = _package_id and active for update;
  if not found then raise exception 'Package not found'; end if;

  if _account_ref is null or length(trim(_account_ref)) < 4 then
    raise exception 'Valid account/phone required';
  end if;

  _otp := lpad((floor(random() * 1000000))::int::text, 6, '0');

  insert into public.recharge_orders
    (user_id, package_id, method, account_ref, amount_pkr, coins_total, otp_code)
  values
    (auth.uid(), _pkg.id, _method, trim(_account_ref),
     _pkg.price_pkr, _pkg.coins + _pkg.bonus_coins, _otp)
  returning * into _order;

  return query select _order.id, _order.otp_code, _order.otp_expires_at,
                      _order.amount_pkr, _order.coins_total;
end $$;

grant execute on function public.recharge_initiate(uuid, public.recharge_pay_method, text) to authenticated;

-- ---------- 4. Verify OTP & credit coins -----------------------------------
create or replace function public.recharge_verify_otp(
  _order_id uuid,
  _otp text
) returns table (success boolean, coins_credited int, new_balance bigint, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  _order public.recharge_orders%rowtype;
  _new_balance bigint;
begin
  if auth.uid() is null then raise exception 'Auth required'; end if;

  select * into _order from public.recharge_orders
    where id = _order_id and user_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;

  if _order.status <> 'pending_otp' then
    return query select false, 0, 0::bigint, 'Order already processed'::text;
    return;
  end if;

  if now() > _order.otp_expires_at then
    update public.recharge_orders set status = 'expired' where id = _order.id;
    return query select false, 0, 0::bigint, 'OTP expired'::text;
    return;
  end if;

  if _order.otp_attempts >= 5 then
    update public.recharge_orders set status = 'failed' where id = _order.id;
    return query select false, 0, 0::bigint, 'Too many attempts'::text;
    return;
  end if;

  if _order.otp_code <> _otp then
    update public.recharge_orders set otp_attempts = otp_attempts + 1 where id = _order.id;
    return query select false, 0, 0::bigint, 'Invalid OTP'::text;
    return;
  end if;

  -- Credit coins
  update public.profiles set coins = coins + _order.coins_total
   where id = _order.user_id
   returning coins into _new_balance;

  update public.recharge_orders
     set status = 'completed', completed_at = now()
   where id = _order.id;

  insert into public.wallet_transactions
    (user_id, kind, coins_delta, balance_coins_after, ref_type, ref_id, note)
  values
    (_order.user_id, 'recharge', _order.coins_total, _new_balance::int,
     'recharge_order', _order.id,
     'Recharge via ' || _order.method::text || ' (auto)');

  return query select true, _order.coins_total, _new_balance,
                      ('Success! ' || _order.coins_total || ' coins credited')::text;
end $$;

grant execute on function public.recharge_verify_otp(uuid, text) to authenticated;

notify pgrst, 'reload schema';
