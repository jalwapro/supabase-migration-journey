-- ============================================================================
-- Shop upgrade: rename "Theme Shop" to "Shop", diamond-based purchases,
-- animated (gif/webp/mp4) preview per item, per-item duration, category icons.
-- Extends existing themes / theme_categories / user_themes.
-- ============================================================================

-- ---------- theme_categories: add icon_url ----------
alter table public.theme_categories
  add column if not exists icon_url text,
  add column if not exists slug text;

-- ---------- themes: add shop columns ----------
alter table public.themes
  add column if not exists category_id uuid references public.theme_categories(id) on delete set null,
  add column if not exists preview_url text,
  add column if not exists animation_url text,          -- gif / webp / mp4 played inside card
  add column if not exists price_diamonds integer not null default 0,
  add column if not exists duration_days integer,       -- null = permanent
  add column if not exists is_premium boolean not null default false;

create index if not exists idx_themes_category on public.themes(category_id, sort);
create index if not exists idx_themes_active on public.themes(is_active) where is_active;

-- ---------- user_themes: add expiry ----------
alter table public.user_themes
  add column if not exists expires_at timestamptz,
  add column if not exists purchased_price_diamonds integer not null default 0;

create index if not exists idx_user_themes_user on public.user_themes(user_id, expires_at);

-- allow users to modify own equipped (needed for insert path via RPC too)
grant insert, update, delete on public.user_themes to authenticated;

drop policy if exists "Users insert own themes" on public.user_themes;
create policy "Users insert own themes" on public.user_themes
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users update own themes" on public.user_themes;
create policy "Users update own themes" on public.user_themes
  for update to authenticated using (auth.uid() = user_id);

-- ---------- Storage bucket for shop assets (gifs, previews) ----------
insert into storage.buckets (id, name, public)
  values ('shop-assets', 'shop-assets', true)
  on conflict (id) do nothing;

drop policy if exists "shop assets public read" on storage.objects;
create policy "shop assets public read" on storage.objects
  for select using (bucket_id = 'shop-assets');

drop policy if exists "admins upload shop assets" on storage.objects;
create policy "admins upload shop assets" on storage.objects
  for insert to authenticated with check (bucket_id = 'shop-assets' and public.is_admin(auth.uid()));

drop policy if exists "admins update shop assets" on storage.objects;
create policy "admins update shop assets" on storage.objects
  for update to authenticated using (bucket_id = 'shop-assets' and public.is_admin(auth.uid()));

drop policy if exists "admins delete shop assets" on storage.objects;
create policy "admins delete shop assets" on storage.objects
  for delete to authenticated using (bucket_id = 'shop-assets' and public.is_admin(auth.uid()));

-- ---------- purchase_shop_item RPC (diamond-based, atomic) ----------
create or replace function public.purchase_shop_item(_theme_id uuid)
returns public.user_themes
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _t public.themes%rowtype;
  _new_bal int;
  _expires timestamptz;
  _row public.user_themes;
begin
  if _uid is null then raise exception 'Sign in to buy'; end if;
  select * into _t from public.themes where id = _theme_id and is_active;
  if not found then raise exception 'Item not found'; end if;
  if _t.price_diamonds < 0 then raise exception 'Invalid price'; end if;

  if _t.price_diamonds > 0 then
    update public.profiles
       set diamonds = diamonds - _t.price_diamonds, updated_at = now()
     where id = _uid and diamonds >= _t.price_diamonds
     returning diamonds into _new_bal;
    if not found then raise exception 'Not enough diamonds'; end if;

    insert into public.wallet_transactions (user_id, kind, diamonds_delta, ref_type, ref_id, note)
      values (_uid, 'shop_purchase', -_t.price_diamonds, 'theme', _t.id,
              'Bought ' || _t.name);
  end if;

  if _t.duration_days is not null and _t.duration_days > 0 then
    _expires := now() + (_t.duration_days || ' days')::interval;
  else
    _expires := null;
  end if;

  insert into public.user_themes (user_id, theme_id, expires_at, purchased_price_diamonds)
    values (_uid, _theme_id, _expires, _t.price_diamonds)
    on conflict (user_id, theme_id) do update
      set expires_at = case
            when public.user_themes.expires_at is null then null
            when excluded.expires_at is null then null
            else greatest(public.user_themes.expires_at, now()) + (_t.duration_days || ' days')::interval
          end,
          purchased_price_diamonds = _t.price_diamonds
    returning * into _row;

  return _row;
end $$;

grant execute on function public.purchase_shop_item(uuid) to authenticated;

-- ---------- Seed default shop categories (idempotent by slug) ----------
insert into public.theme_categories (name, slug, sort_order, is_active) values
  ('Car',        'car',        1, true),
  ('Frame',      'frame',      2, true),
  ('Special ID', 'special_id', 3, true),
  ('Ring',       'ring',       4, true),
  ('Data Card',  'data_card',  5, true),
  ('Entrance',   'entrance',   6, true),
  ('Bubble',     'bubble',     7, true)
on conflict do nothing;
