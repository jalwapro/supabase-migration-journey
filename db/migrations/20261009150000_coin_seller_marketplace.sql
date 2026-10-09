-- Professional Coin Seller Marketplace
-- Admin-assigned sellers, private inventory, public WhatsApp directory and atomic transfers.

create table if not exists public.coin_sellers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  whatsapp_number text not null,
  public_name text,
  public_note text,
  is_active boolean not null default true,
  is_listed boolean not null default true,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coin_sellers_whatsapp_valid check (whatsapp_number ~ '^[0-9]{8,15}$'),
  constraint coin_sellers_public_name_length check (public_name is null or char_length(public_name) <= 80),
  constraint coin_sellers_public_note_length check (public_note is null or char_length(public_note) <= 240)
);

create table if not exists public.coin_seller_inventory (
  seller_id uuid primary key references public.coin_sellers(user_id) on delete cascade,
  available_coins bigint not null default 0 check (available_coins >= 0),
  total_allocated bigint not null default 0 check (total_allocated >= 0),
  total_sold bigint not null default 0 check (total_sold >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.coin_seller_transactions (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.coin_sellers(user_id) on delete restrict,
  buyer_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('allocation','sale','adjustment')),
  coins bigint not null check (coins > 0),
  inventory_delta bigint not null,
  seller_balance_after bigint not null check (seller_balance_after >= 0),
  buyer_balance_after bigint,
  payment_reference text,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint coin_seller_transaction_shape check (
    (kind = 'sale' and buyer_id is not null and inventory_delta = -coins and buyer_balance_after is not null)
    or (kind = 'allocation' and buyer_id is null and inventory_delta = coins)
    or (kind = 'adjustment' and buyer_id is null and abs(inventory_delta) = coins)
  )
);

create index if not exists idx_coin_sellers_listing on public.coin_sellers(is_listed, is_active, created_at desc);
create index if not exists idx_coin_seller_tx_seller on public.coin_seller_transactions(seller_id, created_at desc);
create index if not exists idx_coin_seller_tx_buyer on public.coin_seller_transactions(buyer_id, created_at desc);

alter table public.coin_sellers enable row level security;
alter table public.coin_seller_inventory enable row level security;
alter table public.coin_seller_transactions enable row level security;

drop policy if exists coin_sellers_public_directory on public.coin_sellers;
create policy coin_sellers_public_directory on public.coin_sellers
  for select to authenticated using (is_active and is_listed);

drop policy if exists coin_sellers_admin_manage on public.coin_sellers;
create policy coin_sellers_admin_manage on public.coin_sellers
  for all to authenticated
  using ((select public.is_admin(auth.uid())))
  with check ((select public.is_admin(auth.uid())));

drop policy if exists coin_seller_inventory_owner_admin_read on public.coin_seller_inventory;
create policy coin_seller_inventory_owner_admin_read on public.coin_seller_inventory
  for select to authenticated
  using (seller_id = (select auth.uid()) or (select public.is_admin(auth.uid())));

drop policy if exists coin_seller_transactions_participant_admin_read on public.coin_seller_transactions;
create policy coin_seller_transactions_participant_admin_read on public.coin_seller_transactions
  for select to authenticated
  using (seller_id = (select auth.uid()) or buyer_id = (select auth.uid()) or (select public.is_admin(auth.uid())));

revoke all on public.coin_sellers from anon, authenticated;
grant select, insert, update, delete on public.coin_sellers to authenticated;
revoke all on public.coin_seller_inventory from anon, authenticated;
revoke all on public.coin_seller_transactions from anon, authenticated;
grant select on public.coin_seller_inventory to authenticated;
grant select on public.coin_seller_transactions to authenticated;
grant all on public.coin_sellers to service_role;
grant all on public.coin_seller_inventory to service_role;
grant all on public.coin_seller_transactions to service_role;

drop trigger if exists trg_coin_sellers_updated_at on public.coin_sellers;
create trigger trg_coin_sellers_updated_at before update on public.coin_sellers
  for each row execute function public.update_updated_at_column();

create or replace function public.admin_adjust_coin_seller_inventory(
  p_seller_id uuid,
  p_delta bigint,
  p_payment_reference text default null,
  p_note text default null
)
returns public.coin_seller_inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory public.coin_seller_inventory;
  v_new_balance bigint;
  v_kind text;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_delta = 0 or p_delta is null or p_delta > 1000000000 or p_delta < -1000000000 then
    raise exception 'Enter a valid non-zero inventory adjustment';
  end if;
  if p_delta > 0 and nullif(trim(coalesce(p_payment_reference, '')), '') is null and nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'Add a payment reference or note before allocating paid coins';
  end if;
  if p_delta < 0 and nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'A reason is required for negative inventory adjustments';
  end if;
  if not exists (select 1 from public.coin_sellers where user_id = p_seller_id and is_active) then
    raise exception 'Seller does not exist or is inactive';
  end if;

  insert into public.coin_seller_inventory(seller_id, available_coins, total_allocated, total_sold)
  values (p_seller_id, 0, 0, 0)
  on conflict (seller_id) do nothing;

  select * into v_inventory from public.coin_seller_inventory
    where seller_id = p_seller_id for update;

  v_new_balance := v_inventory.available_coins + p_delta;
  if v_new_balance < 0 then
    raise exception 'Adjustment exceeds available seller inventory';
  end if;

  v_kind := case when p_delta > 0 then 'allocation' else 'adjustment' end;
  update public.coin_seller_inventory
     set available_coins = v_new_balance,
         total_allocated = total_allocated + greatest(p_delta, 0),
         updated_at = now()
   where seller_id = p_seller_id
   returning * into v_inventory;

  insert into public.coin_seller_transactions
    (seller_id, kind, coins, inventory_delta, seller_balance_after, payment_reference, note, created_by)
  values
    (p_seller_id, v_kind, abs(p_delta), p_delta, v_new_balance,
     nullif(left(trim(coalesce(p_payment_reference, '')), 120), ''),
     nullif(left(trim(coalesce(p_note, '')), 500), ''), auth.uid());

  return v_inventory;
end;
$$;

revoke all on function public.admin_adjust_coin_seller_inventory(uuid, bigint, text, text) from public, anon;
grant execute on function public.admin_adjust_coin_seller_inventory(uuid, bigint, text, text) to authenticated;

create or replace function public.coin_seller_transfer(p_buyer_code text, p_coins bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller public.coin_sellers;
  v_inventory public.coin_seller_inventory;
  v_buyer public.profiles;
  v_seller_balance bigint;
  v_buyer_balance bigint;
  v_tx_id uuid;
  v_lookup text := trim(coalesce(p_buyer_code, ''));
begin
  if auth.uid() is null then
    raise exception 'Sign in to transfer coins' using errcode = '42501';
  end if;
  if p_coins is null or p_coins <= 0 or p_coins > 1000000 then
    raise exception 'Enter a coin amount between 1 and 1,000,000';
  end if;
  if v_lookup = '' then
    raise exception 'Buyer JALWA ID is required';
  end if;

  select * into v_seller from public.coin_sellers
   where user_id = auth.uid() and is_active for update;
  if not found then
    raise exception 'Your Coin Seller account is not active';
  end if;

  insert into public.coin_seller_inventory(seller_id) values (auth.uid())
  on conflict (seller_id) do nothing;
  select * into v_inventory from public.coin_seller_inventory
   where seller_id = auth.uid() for update;

  if v_inventory.available_coins < p_coins then
    raise exception 'Insufficient seller coin inventory';
  end if;

  select * into v_buyer from public.profiles
   where user_code = v_lookup or lower(username) = lower(v_lookup)
   order by case when user_code = v_lookup then 0 else 1 end
   limit 1 for update;
  if not found or v_buyer.status <> 'active' then
    raise exception 'Buyer JALWA ID was not found or account is inactive';
  end if;
  if v_buyer.id = auth.uid() then
    raise exception 'You cannot transfer seller coins to yourself';
  end if;

  update public.profiles set coins = coins + p_coins
   where id = v_buyer.id returning coins into v_buyer_balance;

  update public.coin_seller_inventory
   set available_coins = available_coins - p_coins,
       total_sold = total_sold + p_coins,
       updated_at = now()
   where seller_id = auth.uid()
   returning available_coins into v_seller_balance;

  insert into public.coin_seller_transactions
    (seller_id, buyer_id, kind, coins, inventory_delta, seller_balance_after, buyer_balance_after, note, created_by)
  values
    (auth.uid(), v_buyer.id, 'sale', p_coins, -p_coins, v_seller_balance,
     v_buyer_balance, 'Coin seller transfer', auth.uid())
  returning id into v_tx_id;

  insert into public.wallet_transactions
    (user_id, kind, coins_delta, balance_coins_after, ref_type, ref_id, note)
  values
    (v_buyer.id, 'seller_transfer', p_coins::integer, v_buyer_balance::integer,
     'coin_seller_transfer', v_tx_id,
     'Coins received from seller ' || coalesce(v_seller.public_name, 'JALWA seller'));

  return jsonb_build_object(
    'transaction_id', v_tx_id,
    'buyer_id', v_buyer.id,
    'buyer_username', v_buyer.username,
    'buyer_code', v_buyer.user_code,
    'coins_transferred', p_coins,
    'buyer_balance_after', v_buyer_balance,
    'seller_balance_after', v_seller_balance
  );
end;
$$;

revoke all on function public.coin_seller_transfer(text, bigint) from public, anon;
grant execute on function public.coin_seller_transfer(text, bigint) to authenticated;
