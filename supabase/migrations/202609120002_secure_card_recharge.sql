-- Secure card recharge architecture for Jalwa.
-- Card data never enters Jalwa/Supabase. The payment provider hosts card entry.

create table if not exists public.card_recharge_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  package_id uuid not null references public.coin_packages(id) on delete restrict,
  provider text not null default 'safepay',
  provider_tracker text unique,
  amount_pkr numeric(12,2) not null check (amount_pkr > 0),
  coins_expected bigint not null check (coins_expected > 0),
  currency text not null default 'PKR',
  status text not null default 'pending' check (status in ('pending','paid','failed','cancelled','refunded')),
  provider_status text,
  provider_reference text,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_card_recharge_orders_user on public.card_recharge_orders(user_id, created_at desc);
create index if not exists idx_card_recharge_orders_status on public.card_recharge_orders(status, created_at desc);

alter table public.card_recharge_orders enable row level security;
grant select on public.card_recharge_orders to authenticated;
grant all on public.card_recharge_orders to service_role;

drop policy if exists "users read own card recharge orders" on public.card_recharge_orders;
create policy "users read own card recharge orders" on public.card_recharge_orders
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));

create or replace function public.create_card_recharge_order(_package_id uuid)
returns public.card_recharge_orders
language plpgsql security invoker set search_path = public
as $$
declare p public.coin_packages; r public.card_recharge_orders;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into p from public.coin_packages
  where id = _package_id and coalesce(active, is_active, false) = true;
  if not found then raise exception 'Package not found or inactive'; end if;
  insert into public.card_recharge_orders(user_id, package_id, amount_pkr, coins_expected)
  values (auth.uid(), p.id, coalesce(p.price_pkr, p.price), p.coins + p.bonus_coins)
  returning * into r;
  return r;
end;
$$;
grant execute on function public.create_card_recharge_order(uuid) to authenticated;

create or replace function public.set_card_recharge_tracker(_order_id uuid, _tracker text, _provider_status text default null)
returns public.card_recharge_orders
language plpgsql security definer set search_path = public
as $$
declare r public.card_recharge_orders;
begin
  if not public.is_admin(auth.uid()) and auth.uid() <> (select user_id from public.card_recharge_orders where id = _order_id) then
    raise exception 'not authorized';
  end if;
  update public.card_recharge_orders
  set provider_tracker = _tracker, provider_status = coalesce(_provider_status, provider_status), updated_at = now()
  where id = _order_id and status = 'pending'
  returning * into r;
  if not found then raise exception 'card recharge order not found or already finalized'; end if;
  return r;
end;
$$;
revoke all on function public.set_card_recharge_tracker(uuid,text,text) from public;
grant execute on function public.set_card_recharge_tracker(uuid,text,text) to authenticated;

create or replace function public.credit_card_recharge(
  _order_id uuid, _provider_status text, _provider_reference text default null, _provider_payload jsonb default '{}'::jsonb
)
returns public.card_recharge_orders
language plpgsql security definer set search_path = public
as $$
declare r public.card_recharge_orders; new_balance bigint;
begin
  select * into r from public.card_recharge_orders where id = _order_id for update;
  if not found then raise exception 'card recharge order not found'; end if;
  if r.status = 'paid' then return r; end if;

  if lower(coalesce(_provider_status,'')) not in ('completed','paid','success','succeeded','tracker_ended') then
    update public.card_recharge_orders set
      status = case when lower(coalesce(_provider_status,'')) in ('failed','rejected','cancelled','canceled') then 'failed' else status end,
      provider_status = _provider_status,
      provider_reference = coalesce(_provider_reference, provider_reference),
      metadata = coalesce(_provider_payload, '{}'::jsonb), updated_at = now()
    where id = r.id returning * into r;
    return r;
  end if;

  update public.profiles set coins = coins + r.coins_expected
  where id = r.user_id returning coins into new_balance;
  if not found then raise exception 'wallet profile not found'; end if;

  update public.card_recharge_orders set status = 'paid', provider_status = _provider_status,
    provider_reference = coalesce(_provider_reference, provider_reference), metadata = coalesce(_provider_payload, '{}'::jsonb),
    paid_at = now(), updated_at = now()
  where id = r.id returning * into r;

  insert into public.wallet_transactions(user_id, kind, coins_delta, balance_coins_after, ref_type, ref_id, note)
  values (r.user_id, 'recharge', r.coins_expected, new_balance, 'card_recharge', r.id,
    'Card recharge approved (' || r.provider || ')');
  return r;
end;
$$;
revoke all on function public.credit_card_recharge(uuid,text,text,jsonb) from public;
grant execute on function public.credit_card_recharge(uuid,text,text,jsonb) to service_role;

create or replace function public.touch_card_recharge_orders_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_card_recharge_orders_updated_at on public.card_recharge_orders;
create trigger trg_card_recharge_orders_updated_at before update on public.card_recharge_orders
for each row execute function public.touch_card_recharge_orders_updated_at();
