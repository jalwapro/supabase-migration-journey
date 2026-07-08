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
--   1. Adds every alias column that either half of the app expects.
--   2. Back-fills the alias from the existing column.
--   3. Installs BEFORE INSERT/UPDATE triggers that keep the two columns
--      synced on any future write, so admin and user code both work.
--
-- Safe to run multiple times.
-- ============================================================================

-- ---------- gifts --------------------------------------------------------
alter table public.gifts
  add column if not exists icon           text,
  add column if not exists emoji          text,
  add column if not exists price_coins    integer,
  add column if not exists price          integer,
  add column if not exists active         boolean,
  add column if not exists is_active      boolean,
  add column if not exists image_url      text,
  add column if not exists diamonds_value integer not null default 0,
  add column if not exists sort_order     integer not null default 0,
  add column if not exists category       text default 'popular',
  add column if not exists animation      text default 'pop';

update public.gifts set emoji       = coalesce(emoji, icon)               where emoji       is null;
update public.gifts set icon        = coalesce(icon, emoji)                where icon        is null;
update public.gifts set price       = coalesce(price, price_coins, 0)      where price       is null;
update public.gifts set price_coins = coalesce(price_coins, price, 0)      where price_coins is null;
update public.gifts set active      = coalesce(active, is_active, true)    where active      is null;
update public.gifts set is_active   = coalesce(is_active, active, true)    where is_active   is null;

create or replace function public._sync_gifts()
returns trigger language plpgsql as $$
begin
  if new.emoji is null and new.icon is not null then new.emoji := new.icon; end if;
  if new.icon  is null and new.emoji is not null then new.icon  := new.emoji; end if;
  if new.price is null and new.price_coins is not null then new.price := new.price_coins; end if;
  if new.price_coins is null and new.price is not null then new.price_coins := new.price; end if;
  if new.is_active is null and new.active is not null then new.is_active := new.active; end if;
  if new.active is null and new.is_active is not null then new.active := new.is_active; end if;
  return new;
end $$;

drop trigger if exists trg_gifts_sync on public.gifts;
create trigger trg_gifts_sync
  before insert or update on public.gifts
  for each row execute function public._sync_gifts();

-- ---------- coin_packages ------------------------------------------------
alter table public.coin_packages
  add column if not exists active    boolean,
  add column if not exists is_active boolean,
  add column if not exists price     numeric(12,2),
  add column if not exists price_pkr numeric(12,2),
  add column if not exists bonus_coins integer not null default 0,
  add column if not exists sort_order  integer not null default 0,
  add column if not exists label       text,
  add column if not exists badge       text;

update public.coin_packages set active    = coalesce(active, is_active, true) where active    is null;
update public.coin_packages set is_active = coalesce(is_active, active, true) where is_active is null;
update public.coin_packages set price     = coalesce(price, price_pkr, 0)     where price     is null;
update public.coin_packages set price_pkr = coalesce(price_pkr, price, 0)     where price_pkr is null;

create or replace function public._sync_coin_packages()
returns trigger language plpgsql as $$
begin
  if new.is_active is null and new.active is not null then new.is_active := new.active; end if;
  if new.active is null and new.is_active is not null then new.active := new.is_active; end if;
  if new.price is null and new.price_pkr is not null then new.price := new.price_pkr; end if;
  if new.price_pkr is null and new.price is not null then new.price_pkr := new.price; end if;
  return new;
end $$;

drop trigger if exists trg_coin_pkg_sync on public.coin_packages;
create trigger trg_coin_pkg_sync
  before insert or update on public.coin_packages
  for each row execute function public._sync_coin_packages();

-- ---------- banners ------------------------------------------------------
alter table public.banners
  add column if not exists image_url  text,
  add column if not exists image      text,
  add column if not exists active     boolean,
  add column if not exists is_active  boolean,
  add column if not exists link_url   text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists subtitle   text,
  add column if not exists starts_at  timestamptz,
  add column if not exists ends_at    timestamptz;

update public.banners set image_url = coalesce(image_url, image)           where image_url is null;
update public.banners set image     = coalesce(image, image_url)           where image     is null;
update public.banners set active    = coalesce(active, is_active, true)    where active    is null;
update public.banners set is_active = coalesce(is_active, active, true)    where is_active is null;

create or replace function public._sync_banners()
returns trigger language plpgsql as $$
begin
  if new.image_url is null and new.image is not null then new.image_url := new.image; end if;
  if new.image is null and new.image_url is not null then new.image := new.image_url; end if;
  if new.is_active is null and new.active is not null then new.is_active := new.active; end if;
  if new.active is null and new.is_active is not null then new.active := new.is_active; end if;
  return new;
end $$;

drop trigger if exists trg_banners_sync on public.banners;
create trigger trg_banners_sync
  before insert or update on public.banners
  for each row execute function public._sync_banners();

-- ---------- wallet_transactions -----------------------------------------
alter table public.wallet_transactions
  add column if not exists coins_delta    integer,
  add column if not exists coins          integer,
  add column if not exists diamonds_delta integer,
  add column if not exists diamonds       integer;

update public.wallet_transactions set coins_delta    = coalesce(coins_delta, coins, 0)       where coins_delta    is null;
update public.wallet_transactions set coins          = coalesce(coins, coins_delta, 0)       where coins          is null;
update public.wallet_transactions set diamonds_delta = coalesce(diamonds_delta, diamonds, 0) where diamonds_delta is null;
update public.wallet_transactions set diamonds       = coalesce(diamonds, diamonds_delta, 0) where diamonds       is null;

create or replace function public._sync_wallet_tx()
returns trigger language plpgsql as $$
begin
  if new.coins_delta is null and new.coins is not null then new.coins_delta := new.coins; end if;
  if new.coins is null and new.coins_delta is not null then new.coins := new.coins_delta; end if;
  if new.diamonds_delta is null and new.diamonds is not null then new.diamonds_delta := new.diamonds; end if;
  if new.diamonds is null and new.diamonds_delta is not null then new.diamonds := new.diamonds_delta; end if;
  return new;
end $$;

drop trigger if exists trg_wallet_tx_sync on public.wallet_transactions;
create trigger trg_wallet_tx_sync
  before insert or update on public.wallet_transactions
  for each row execute function public._sync_wallet_tx();

-- ---------- gallery_images: add sort_order used by profile gallery -----
alter table public.gallery_images
  add column if not exists sort_order integer not null default 0;

create index if not exists idx_gallery_images_user_sort
  on public.gallery_images(user_id, sort_order);

-- ---------- grants (idempotent safety net) -----------------------------
grant insert, update, delete on public.gifts               to authenticated;
grant insert, update, delete on public.coin_packages       to authenticated;
grant insert, update, delete on public.banners             to authenticated;
grant insert                 on public.wallet_transactions to authenticated;
grant select                 on public.wallet_transactions to authenticated;
