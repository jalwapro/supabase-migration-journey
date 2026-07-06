-- ============================================================================
-- Jalwa — Phase 4: Wallet + Manual Recharge
-- Coin packages, recharge requests with proof upload, wallet transactions
-- ============================================================================

do $$ begin
  create type public.recharge_method as enum ('jazzcash','easypaisa','bank','crypto','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.recharge_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.wallet_tx_kind as enum (
    'recharge','gift_sent','gift_received','withdraw','admin_grant','admin_debit','refund','game'
  );
exception when duplicate_object then null; end $$;

-- ---------- coin_packages -------------------------------------------------
create table if not exists public.coin_packages (
  id uuid primary key default gen_random_uuid(),
  coins int not null check (coins > 0),
  bonus_coins int not null default 0,
  price_pkr numeric(12,2) not null check (price_pkr > 0),
  label text,
  badge text,          -- e.g. "Most Popular", "Best Value"
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

grant select on public.coin_packages to anon, authenticated;
grant all on public.coin_packages to service_role;

alter table public.coin_packages enable row level security;

drop policy if exists "coin packages public read" on public.coin_packages;
create policy "coin packages public read"
  on public.coin_packages for select using (active or public.is_admin(auth.uid()));

drop policy if exists "admins manage coin packages" on public.coin_packages;
create policy "admins manage coin packages"
  on public.coin_packages for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ---------- recharge_requests ---------------------------------------------
create table if not exists public.recharge_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  package_id uuid references public.coin_packages(id) on delete set null,
  method public.recharge_method not null,
  amount_pkr numeric(12,2) not null check (amount_pkr > 0),
  coins_expected int not null check (coins_expected > 0),
  proof_url text,
  sender_name text,
  sender_account text,
  txn_reference text,
  note text,
  status public.recharge_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_recharge_user on public.recharge_requests(user_id, created_at desc);
create index if not exists idx_recharge_status on public.recharge_requests(status, created_at desc);

grant select, insert on public.recharge_requests to authenticated;
grant update on public.recharge_requests to authenticated;
grant all on public.recharge_requests to service_role;

alter table public.recharge_requests enable row level security;

drop policy if exists "user reads own recharges" on public.recharge_requests;
create policy "user reads own recharges"
  on public.recharge_requests for select to authenticated
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "user creates own recharge" on public.recharge_requests;
create policy "user creates own recharge"
  on public.recharge_requests for insert to authenticated
  with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "admins update recharges" on public.recharge_requests;
create policy "admins update recharges"
  on public.recharge_requests for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ---------- wallet_transactions -------------------------------------------
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.wallet_tx_kind not null,
  coins_delta int not null default 0,
  diamonds_delta int not null default 0,
  balance_coins_after int,
  balance_diamonds_after int,
  ref_type text,       -- 'recharge' | 'gift' | 'game' | ...
  ref_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_wallet_tx_user on public.wallet_transactions(user_id, created_at desc);

grant select on public.wallet_transactions to authenticated;
grant all on public.wallet_transactions to service_role;

alter table public.wallet_transactions enable row level security;

drop policy if exists "user reads own tx" on public.wallet_transactions;
create policy "user reads own tx"
  on public.wallet_transactions for select to authenticated
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- ---------- Approve recharge RPC (SECURITY DEFINER) -----------------------
create or replace function public.approve_recharge(
  _request_id uuid,
  _admin_note text default null
) returns public.recharge_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.recharge_requests;
  new_balance int;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  select * into r from public.recharge_requests where id = _request_id for update;
  if not found then raise exception 'recharge not found'; end if;
  if r.status <> 'pending' then raise exception 'already reviewed'; end if;

  update public.profiles
     set coins = coins + r.coins_expected
   where id = r.user_id
   returning coins into new_balance;

  update public.recharge_requests
     set status = 'approved',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         admin_note = _admin_note
   where id = _request_id
   returning * into r;

  insert into public.wallet_transactions
    (user_id, kind, coins_delta, balance_coins_after, ref_type, ref_id, note)
  values
    (r.user_id, 'recharge', r.coins_expected, new_balance, 'recharge', r.id,
     'Recharge approved (' || r.method::text || ')');

  return r;
end $$;

grant execute on function public.approve_recharge(uuid, text) to authenticated;

create or replace function public.reject_recharge(
  _request_id uuid,
  _admin_note text default null
) returns public.recharge_requests
language plpgsql
security definer
set search_path = public
as $$
declare r public.recharge_requests;
begin
  if not public.is_admin(auth.uid()) then raise exception 'not authorized'; end if;
  update public.recharge_requests
     set status = 'rejected',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         admin_note = _admin_note
   where id = _request_id and status = 'pending'
   returning * into r;
  if not found then raise exception 'recharge not found or already reviewed'; end if;
  return r;
end $$;

grant execute on function public.reject_recharge(uuid, text) to authenticated;

-- ---------- Storage bucket for proofs -------------------------------------
insert into storage.buckets (id, name, public)
values ('recharge-proofs', 'recharge-proofs', true)
on conflict (id) do nothing;

drop policy if exists "recharge proofs public read" on storage.objects;
create policy "recharge proofs public read"
  on storage.objects for select
  using (bucket_id = 'recharge-proofs');

drop policy if exists "auth users upload own proofs" on storage.objects;
create policy "auth users upload own proofs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'recharge-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "auth users manage own proofs" on storage.objects;
create policy "auth users manage own proofs"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'recharge-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------- Seed default packages ----------------------------------------
insert into public.coin_packages (coins, bonus_coins, price_pkr, label, badge, sort_order) values
  (500,      0,   100,   'Starter',       null,             1),
  (1500,   100,   300,   'Basic',         null,             2),
  (5000,   500,  1000,   'Popular',       'Most Popular',   3),
  (12000, 2000,  2000,   'Value',         'Best Value',     4),
  (30000, 6000,  5000,   'Pro',           null,             5),
  (75000,20000, 10000,   'VIP',           'VIP',            6)
on conflict do nothing;
