-- Auditable seller funding: record the money received and coins credited in one atomic transaction.
create table if not exists public.coin_seller_funding_audit (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete restrict,
  amount_pkr numeric(14,2) not null check (amount_pkr > 0),
  coins_credited bigint not null check (coins_credited > 0),
  coins_per_pkr numeric(18,6) generated always as (coins_credited::numeric / amount_pkr) stored,
  payment_method text not null check (payment_method in ('bank_transfer','jazzcash','easypaisa','cash','other')),
  payment_reference text not null check (char_length(trim(payment_reference)) between 1 and 160),
  note text,
  inventory_before bigint not null check (inventory_before >= 0),
  inventory_after bigint not null check (inventory_after >= inventory_before),
  verified_by uuid not null references auth.users(id) on delete restrict,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_coin_seller_funding_seller_created
  on public.coin_seller_funding_audit (seller_id, created_at desc);
create index if not exists idx_coin_seller_funding_verified_created
  on public.coin_seller_funding_audit (verified_at desc);

alter table public.coin_seller_funding_audit enable row level security;
revoke all on public.coin_seller_funding_audit from anon, authenticated;
grant select on public.coin_seller_funding_audit to authenticated;

drop policy if exists coin_seller_funding_admin_read on public.coin_seller_funding_audit;
create policy coin_seller_funding_admin_read
  on public.coin_seller_funding_audit for select to authenticated
  using ((select public.is_admin(auth.uid())));

create or replace function public.admin_verify_coin_seller_payment(
  p_seller_id uuid,
  p_amount_pkr numeric,
  p_coins bigint,
  p_payment_method text,
  p_payment_reference text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory public.coin_seller_inventory;
  v_before bigint;
  v_after bigint;
  v_audit_id uuid;
  v_reference text := left(trim(coalesce(p_payment_reference, '')), 160);
  v_note text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_seller_id is null or not exists (
    select 1 from public.coin_sellers where user_id = p_seller_id and is_active
  ) then
    raise exception 'Seller does not exist or is inactive';
  end if;
  if p_amount_pkr is null or p_amount_pkr <= 0 or p_amount_pkr > 100000000000 then
    raise exception 'Enter a valid received amount in PKR';
  end if;
  if p_coins is null or p_coins <= 0 or p_coins > 1000000000 then
    raise exception 'Enter a valid coin amount';
  end if;
  if p_payment_method not in ('bank_transfer','jazzcash','easypaisa','cash','other') then
    raise exception 'Select a valid payment method';
  end if;
  if v_reference = '' then
    raise exception 'Payment reference or receipt number is required';
  end if;

  insert into public.coin_seller_inventory(seller_id, available_coins, total_allocated, total_sold)
  values (p_seller_id, 0, 0, 0)
  on conflict (seller_id) do nothing;

  select * into v_inventory
    from public.coin_seller_inventory
   where seller_id = p_seller_id
   for update;

  v_before := v_inventory.available_coins;
  v_after := v_before + p_coins;
  if v_after > 9000000000000000000 then
    raise exception 'Seller inventory would exceed supported limit';
  end if;

  update public.coin_seller_inventory
     set available_coins = v_after,
         total_allocated = total_allocated + p_coins,
         updated_at = now()
   where seller_id = p_seller_id;

  insert into public.coin_seller_funding_audit
    (seller_id, amount_pkr, coins_credited, payment_method, payment_reference, note,
     inventory_before, inventory_after, verified_by)
  values
    (p_seller_id, round(p_amount_pkr, 2), p_coins, p_payment_method, v_reference, v_note,
     v_before, v_after, auth.uid())
  returning id into v_audit_id;

  insert into public.coin_seller_transactions
    (seller_id, kind, coins, inventory_delta, seller_balance_after, payment_reference, note, created_by)
  values
    (p_seller_id, 'allocation', p_coins, p_coins, v_after, v_reference,
     concat('Verified payment PKR ', to_char(round(p_amount_pkr, 2), 'FM999999999999990.00'),
       ' via ', p_payment_method, '; audit ', v_audit_id::text,
       case when v_note is null then '' else '; ' || v_note end), auth.uid());

  return jsonb_build_object(
    'audit_id', v_audit_id,
    'seller_id', p_seller_id,
    'amount_pkr', round(p_amount_pkr, 2),
    'coins_credited', p_coins,
    'coins_per_pkr', round(p_coins::numeric / p_amount_pkr, 6),
    'inventory_before', v_before,
    'inventory_after', v_after,
    'verified_by', auth.uid()
  );
end;
$$;

revoke all on function public.admin_verify_coin_seller_payment(uuid, numeric, bigint, text, text, text) from public, anon;
grant execute on function public.admin_verify_coin_seller_payment(uuid, numeric, bigint, text, text, text) to authenticated;
