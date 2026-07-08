-- ============================================================================
-- 0024_column_aliases_and_sync.sql
--
-- Reconciles the split-brain schema between the 0003/0004 migrations and the
-- 0006 phase-A schema.  Different parts of the app were written against
-- different column names (e.g. `gifts.icon` vs `gifts.emoji`,
-- `wallet_transactions.coins_delta` vs `coins`, `banners.image_url` vs
-- `image`).  Rather than force-rename columns (which would break whichever
-- half is currently live), this migration:
--
--   1. Adds every alias column that either half of the app expects
--      (IF NOT EXISTS — safe on any existing schema).
--   2. Back-fills the alias from the existing column so old rows read the
--      same value regardless of which name is queried.
--   3. Installs triggers that keep the two columns synced on any future
--      INSERT/UPDATE.
--
-- Safe to run multiple times.  Runs cleanly against a fresh DB, a
-- 0003-era DB, a 0006-era DB, or any mix.
-- ============================================================================

-- ---------- helper: column sync trigger factory --------------------------
create or replace function public._sync_pair()
returns trigger
language plpgsql
as $$
declare
  a text := tg_argv[0];
  b text := tg_argv[1];
  a_val text;
  b_val text;
begin
  execute format('select ($1).%I::text, ($1).%I::text', a, b)
    using new into a_val, b_val;

  if a_val is null and b_val is not null then
    new := new #= hstore(a, b_val);
  elsif b_val is null and a_val is not null then
    new := new #= hstore(b, a_val);
  end if;
  return new;
end;
$$;

-- hstore is required by _sync_pair; enable if missing (safe if already on)
create extension if not exists hstore;

-- Re-create with hstore now available (function body references hstore)
create or replace function public._sync_pair()
returns trigger
language plpgsql
as $$
declare
  a text := tg_argv[0];
  b text := tg_argv[1];
  a_val text;
  b_val text;
begin
  execute format('select ($1).%I::text, ($1).%I::text', a, b)
    using new into a_val, b_val;

  if a_val is null and b_val is not null then
    new := new #= hstore(a, b_val);
  elsif b_val is null and a_val is not null then
    new := new #= hstore(b, a_val);
  end if;
  return new;
end;
$$;

-- ---------- gifts: icon <-> emoji, price_coins <-> price, active <-> is_active
alter table public.gifts
  add column if not exists icon         text,
  add column if not exists emoji        text,
  add column if not exists price_coins  integer,
  add column if not exists price        integer,
  add column if not exists active       boolean,
  add column if not exists is_active    boolean,
  add column if not exists image_url    text,
  add column if not exists diamonds_value integer not null default 0;

update public.gifts set emoji       = coalesce(emoji, icon)              where emoji is null;
update public.gifts set icon        = coalesce(icon, emoji)              where icon is null;
update public.gifts set price       = coalesce(price, price_coins, 0)    where price is null;
update public.gifts set price_coins = coalesce(price_coins, price, 0)    where price_coins is null;
update public.gifts set active      = coalesce(active, is_active, true)  where active is null;
update public.gifts set is_active   = coalesce(is_active, active, true)  where is_active is null;

drop trigger if exists trg_gifts_sync_names on public.gifts;
create trigger trg_gifts_sync_names
  before insert or update on public.gifts
  for each row execute function public._sync_pair('icon', 'emoji');

drop trigger if exists trg_gifts_sync_price on public.gifts;
create trigger trg_gifts_sync_price
  before insert or update on public.gifts
  for each row execute function public._sync_pair('price_coins', 'price');

drop trigger if exists trg_gifts_sync_active on public.gifts;
create trigger trg_gifts_sync_active
  before insert or update on public.gifts
  for each row execute function public._sync_pair('active', 'is_active');

-- ---------- coin_packages: active <-> is_active, price_pkr <-> price -----
alter table public.coin_packages
  add column if not exists active    boolean,
  add column if not exists is_active boolean,
  add column if not exists price     numeric(12,2),
  add column if not exists price_pkr numeric(12,2);

update public.coin_packages set active    = coalesce(active, is_active, true) where active is null;
update public.coin_packages set is_active = coalesce(is_active, active, true) where is_active is null;
update public.coin_packages set price     = coalesce(price, price_pkr, 0)     where price is null;
update public.coin_packages set price_pkr = coalesce(price_pkr, price, 0)     where price_pkr is null;

drop trigger if exists trg_coin_pkg_sync_active on public.coin_packages;
create trigger trg_coin_pkg_sync_active
  before insert or update on public.coin_packages
  for each row execute function public._sync_pair('active', 'is_active');

drop trigger if exists trg_coin_pkg_sync_price on public.coin_packages;
create trigger trg_coin_pkg_sync_price
  before insert or update on public.coin_packages
  for each row execute function public._sync_pair('price_pkr', 'price');

-- ---------- banners: image_url <-> image, active <-> is_active -----------
alter table public.banners
  add column if not exists image_url text,
  add column if not exists image     text,
  add column if not exists active    boolean,
  add column if not exists is_active boolean,
  add column if not exists link_url  text,
  add column if not exists sort_order int not null default 0;

update public.banners set image_url = coalesce(image_url, image)           where image_url is null;
update public.banners set image     = coalesce(image, image_url)           where image is null;
update public.banners set active    = coalesce(active, is_active, true)    where active is null;
update public.banners set is_active = coalesce(is_active, active, true)    where is_active is null;

drop trigger if exists trg_banners_sync_image on public.banners;
create trigger trg_banners_sync_image
  before insert or update on public.banners
  for each row execute function public._sync_pair('image_url', 'image');

drop trigger if exists trg_banners_sync_active on public.banners;
create trigger trg_banners_sync_active
  before insert or update on public.banners
  for each row execute function public._sync_pair('active', 'is_active');

-- ---------- wallet_transactions: coins_delta <-> coins, diamonds_delta <-> diamonds
alter table public.wallet_transactions
  add column if not exists coins_delta    integer,
  add column if not exists coins          integer,
  add column if not exists diamonds_delta integer,
  add column if not exists diamonds       integer;

update public.wallet_transactions set coins_delta    = coalesce(coins_delta, coins, 0)          where coins_delta is null;
update public.wallet_transactions set coins          = coalesce(coins, coins_delta, 0)          where coins is null;
update public.wallet_transactions set diamonds_delta = coalesce(diamonds_delta, diamonds, 0)    where diamonds_delta is null;
update public.wallet_transactions set diamonds       = coalesce(diamonds, diamonds_delta, 0)   where diamonds is null;

drop trigger if exists trg_wallet_sync_coins on public.wallet_transactions;
create trigger trg_wallet_sync_coins
  before insert or update on public.wallet_transactions
  for each row execute function public._sync_pair('coins_delta', 'coins');

drop trigger if exists trg_wallet_sync_diamonds on public.wallet_transactions;
create trigger trg_wallet_sync_diamonds
  before insert or update on public.wallet_transactions
  for each row execute function public._sync_pair('diamonds_delta', 'diamonds');

-- ---------- gallery_images: add sort_order used by profile gallery ------
alter table public.gallery_images
  add column if not exists sort_order integer not null default 0;

create index if not exists idx_gallery_images_user_sort
  on public.gallery_images(user_id, sort_order);

-- ---------- grants (idempotent, safety net) -----------------------------
grant insert, update, delete on public.gifts             to authenticated;
grant insert, update, delete on public.coin_packages     to authenticated;
grant insert, update, delete on public.banners           to authenticated;
grant insert                 on public.wallet_transactions to authenticated;
