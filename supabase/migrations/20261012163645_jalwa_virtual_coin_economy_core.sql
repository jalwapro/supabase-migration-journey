-- JALWA Virtual Coin Economy core audit schema.
-- Canonical balances remain profiles.coins and coin_seller_inventory.available_coins.
create table if not exists public.coin_economy_transactions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  request_key text,
  kind text not null,
  status text not null default 'pending' check (status in ('pending','posted','reversed','rejected')),
  reference_type text,
  reference_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint coin_economy_request_key_len check (request_key is null or length(request_key) between 8 and 160)
);
create unique index if not exists coin_economy_actor_request_key_uq
  on public.coin_economy_transactions(actor_id, request_key) where request_key is not null;
create index if not exists coin_economy_transactions_reference_idx
  on public.coin_economy_transactions(reference_type, reference_id);
create index if not exists coin_economy_transactions_actor_created_idx
  on public.coin_economy_transactions(actor_id, created_at desc);

create table if not exists public.coin_economy_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.coin_economy_transactions(id),
  account_type text not null check (account_type in ('user_wallet','seller_inventory','treasury')),
  account_id uuid,
  asset text not null default 'coin' check (asset = 'coin'),
  amount bigint not null check (amount <> 0),
  balance_after bigint,
  created_at timestamptz not null default now()
);
create index if not exists coin_economy_entries_transaction_idx on public.coin_economy_entries(transaction_id);
create index if not exists coin_economy_entries_account_idx on public.coin_economy_entries(account_type, account_id, created_at desc);

create table if not exists public.coin_economy_balance_events (
  id uuid primary key default gen_random_uuid(),
  database_transaction_id bigint not null,
  account_type text not null check (account_type in ('user_wallet','seller_inventory')),
  account_id uuid not null,
  delta bigint not null,
  balance_after bigint not null,
  actor_id uuid,
  operation text,
  created_at timestamptz not null default now()
);
create index if not exists coin_economy_balance_events_account_idx
  on public.coin_economy_balance_events(account_type, account_id, created_at desc);
create index if not exists coin_economy_balance_events_dbtx_idx on public.coin_economy_balance_events(database_transaction_id);

create table if not exists public.coin_inventory_requests (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id),
  requested_amount bigint not null check (requested_amount between 1 and 1000000000),
  approved_amount bigint check (approved_amount between 1 and 1000000000),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  agent_note text,
  admin_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  transaction_id uuid references public.coin_economy_transactions(id),
  created_at timestamptz not null default now()
);
create index if not exists coin_inventory_requests_agent_idx on public.coin_inventory_requests(agent_id, created_at desc);
create index if not exists coin_inventory_requests_status_idx on public.coin_inventory_requests(status, created_at);

create table if not exists public.coin_agent_price_history (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id),
  price_kind text not null,
  old_price numeric,
  new_price numeric,
  currency_code text not null default 'PKR',
  changed_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists coin_agent_price_history_agent_idx on public.coin_agent_price_history(agent_id, created_at desc);

create table if not exists public.coin_economy_settings (
  id boolean primary key default true check (id),
  p2p_user_transfers_enabled boolean not null default false,
  cash_withdrawals_enabled boolean not null default false,
  max_p2p_transfer bigint not null default 100000 check (max_p2p_transfer between 1 and 1000000000),
  daily_p2p_limit bigint not null default 250000 check (daily_p2p_limit between 1 and 10000000000),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.coin_economy_settings(id) values(true) on conflict(id) do nothing;

create table if not exists public.coin_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  coins bigint not null check (coins > 0),
  payout_amount numeric(14,2) check (payout_amount > 0),
  currency_code text not null default 'PKR',
  payout_method text,
  payout_account_masked text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','paid','cancelled')),
  admin_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  payout_reference text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.coin_economy_transactions enable row level security;
alter table public.coin_economy_entries enable row level security;
alter table public.coin_economy_balance_events enable row level security;
alter table public.coin_inventory_requests enable row level security;
alter table public.coin_agent_price_history enable row level security;
alter table public.coin_economy_settings enable row level security;
alter table public.coin_withdrawal_requests enable row level security;

drop policy if exists "coin economy transactions read own or admin" on public.coin_economy_transactions;
create policy "coin economy transactions read own or admin" on public.coin_economy_transactions for select to authenticated
using (actor_id = auth.uid() or public.is_admin(auth.uid()));
drop policy if exists "coin economy entries read via own transaction" on public.coin_economy_entries;
create policy "coin economy entries read via own transaction" on public.coin_economy_entries for select to authenticated
using (exists (select 1 from public.coin_economy_transactions t where t.id = transaction_id and (t.actor_id = auth.uid() or public.is_admin(auth.uid()))));
drop policy if exists "coin inventory requests read own or admin" on public.coin_inventory_requests;
create policy "coin inventory requests read own or admin" on public.coin_inventory_requests for select to authenticated
using (agent_id = auth.uid() or public.is_admin(auth.uid()));
drop policy if exists "coin agent price history read own or admin" on public.coin_agent_price_history;
create policy "coin agent price history read own or admin" on public.coin_agent_price_history for select to authenticated
using (agent_id = auth.uid() or public.is_admin(auth.uid()));
drop policy if exists "coin economy settings read authenticated" on public.coin_economy_settings;
create policy "coin economy settings read authenticated" on public.coin_economy_settings for select to authenticated using (true);
drop policy if exists "coin withdrawal requests read own or admin" on public.coin_withdrawal_requests;
create policy "coin withdrawal requests read own or admin" on public.coin_withdrawal_requests for select to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

create or replace function public.coin_economy_audit_profile_coins()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.coins is distinct from old.coins then
    insert into public.coin_economy_balance_events(database_transaction_id, account_type, account_id, delta, balance_after, actor_id, operation)
    values (txid_current(), 'user_wallet', new.id, new.coins-old.coins, new.coins, auth.uid(), nullif(current_setting('app.coin_operation', true), ''));
  end if;
  return new;
end; $$;
drop trigger if exists coin_economy_audit_profile_coins_trg on public.profiles;
create trigger coin_economy_audit_profile_coins_trg after update of coins on public.profiles
for each row execute function public.coin_economy_audit_profile_coins();

create or replace function public.coin_economy_audit_seller_inventory()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.available_coins is distinct from old.available_coins then
    insert into public.coin_economy_balance_events(database_transaction_id, account_type, account_id, delta, balance_after, actor_id, operation)
    values (txid_current(), 'seller_inventory', new.seller_id, new.available_coins-old.available_coins, new.available_coins, auth.uid(), nullif(current_setting('app.coin_operation', true), ''));
  end if;
  return new;
end; $$;
drop trigger if exists coin_economy_audit_seller_inventory_trg on public.coin_seller_inventory;
create trigger coin_economy_audit_seller_inventory_trg after update of available_coins on public.coin_seller_inventory
for each row execute function public.coin_economy_audit_seller_inventory();

revoke all on function public.coin_economy_audit_profile_coins() from public, anon, authenticated;
revoke all on function public.coin_economy_audit_seller_inventory() from public, anon, authenticated;
