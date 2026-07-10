-- ============================================================================
-- 0059: Custom user-uploaded themes (with admin approval) + Daily Spin wheel
-- ============================================================================

-- ---------- admin-configurable settings ------------------------------------
alter table public.app_settings
  add column if not exists custom_theme_price_coins int not null default 500,
  add column if not exists custom_theme_duration_hours int not null default 24,
  add column if not exists custom_theme_enabled boolean not null default true,
  add column if not exists daily_spin_enabled boolean not null default true,
  add column if not exists daily_spin_cooldown_hours int not null default 24;

-- ---------- custom_themes: user-uploaded backgrounds ----------------------
create table if not exists public.custom_themes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_url text not null,
  coins_paid int not null default 0,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  admin_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_custom_themes_user on public.custom_themes(user_id, created_at desc);
create index if not exists idx_custom_themes_status on public.custom_themes(status, created_at desc);
create index if not exists idx_custom_themes_active
  on public.custom_themes(user_id, expires_at) where status = 'approved';

grant select, insert on public.custom_themes to authenticated;
grant all on public.custom_themes to service_role;

alter table public.custom_themes enable row level security;

drop policy if exists "user reads own custom themes" on public.custom_themes;
create policy "user reads own custom themes" on public.custom_themes
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "user creates own custom themes" on public.custom_themes;
create policy "user creates own custom themes" on public.custom_themes
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "admin updates custom themes" on public.custom_themes;
create policy "admin updates custom themes" on public.custom_themes
  for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ---------- spin_prizes: admin-managed prize pool -------------------------
create table if not exists public.spin_prizes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  kind text not null check (kind in ('coins','diamonds','theme','frame','nothing')),
  min_amount int not null default 0,
  max_amount int not null default 0,
  duration_days int,
  weight int not null default 1 check (weight > 0),
  color text not null default '#7c3aed',
  is_active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

grant select on public.spin_prizes to authenticated;
grant all on public.spin_prizes to service_role;

alter table public.spin_prizes enable row level security;

drop policy if exists "all read active prizes" on public.spin_prizes;
create policy "all read active prizes" on public.spin_prizes
  for select to authenticated
  using (is_active or public.is_admin(auth.uid()));

drop policy if exists "admin manage prizes" on public.spin_prizes;
create policy "admin manage prizes" on public.spin_prizes
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ---------- daily_spins: log + cooldown tracker ---------------------------
create table if not exists public.daily_spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prize_id uuid references public.spin_prizes(id) on delete set null,
  reward_kind text not null,
  reward_amount int not null default 0,
  reward_label text not null,
  granted_theme_id uuid references public.themes(id),
  next_spin_at timestamptz not null,
  spun_at timestamptz not null default now()
);

create index if not exists idx_daily_spins_user on public.daily_spins(user_id, spun_at desc);

grant select on public.daily_spins to authenticated;
grant all on public.daily_spins to service_role;

alter table public.daily_spins enable row level security;

drop policy if exists "user reads own spins" on public.daily_spins;
create policy "user reads own spins" on public.daily_spins
  for select to authenticated using (auth.uid() = user_id);

-- ============================================================================
-- RPCs
-- ============================================================================

-- submit_custom_theme: deduct coins, insert pending row, notify all admins
create or replace function public.submit_custom_theme(_image_url text)
returns public.custom_themes
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  price int;
  dur_h int;
  enabled boolean;
  bal bigint;
  row public.custom_themes;
  admin_row record;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if _image_url is null or length(_image_url) < 5 then raise exception 'invalid image url'; end if;

  select custom_theme_price_coins, custom_theme_duration_hours, custom_theme_enabled
    into price, dur_h, enabled
    from public.app_settings where id = 'global';
  if not coalesce(enabled, true) then raise exception 'custom theme submissions are disabled'; end if;

  -- refuse if user already has a pending submission
  if exists (select 1 from public.custom_themes where user_id = me and status = 'pending') then
    raise exception 'you already have a pending submission';
  end if;

  select coins into bal from public.profiles where id = me for update;
  if coalesce(bal, 0) < price then raise exception 'not enough coins (need %)', price; end if;

  update public.profiles set coins = coins - price, updated_at = now() where id = me;

  insert into public.custom_themes (user_id, image_url, coins_paid)
    values (me, _image_url, price)
    returning * into row;

  for admin_row in
    select distinct ur.user_id
      from public.user_roles ur
     where ur.role in ('admin'::public.app_role, 'super_admin'::public.app_role)
  loop
    insert into public.notifications
      (user_id, kind, title, body, data, actor_id, entity_type, entity_id)
    values
      (admin_row.user_id, 'system_broadcast',
       'New custom theme pending',
       'A user submitted a custom background for approval',
       jsonb_build_object('custom_theme_id', row.id),
       me, 'custom_theme', row.id::text);
  end loop;

  return row;
end $$;
grant execute on function public.submit_custom_theme(text) to authenticated;

-- approve_custom_theme: mark approved + set expiry + notify user
create or replace function public.approve_custom_theme(_id uuid)
returns public.custom_themes
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  row public.custom_themes;
  dur_h int;
begin
  if not public.is_admin(me) then raise exception 'admin only'; end if;
  select custom_theme_duration_hours into dur_h from public.app_settings where id = 'global';

  update public.custom_themes
     set status = 'approved',
         reviewed_by = me,
         reviewed_at = now(),
         approved_at = now(),
         expires_at = now() + (coalesce(dur_h, 24) || ' hours')::interval
   where id = _id and status = 'pending'
   returning * into row;
  if row.id is null then raise exception 'request not found or already reviewed'; end if;

  insert into public.notifications
    (user_id, kind, title, body, data, actor_id, entity_type, entity_id)
  values
    (row.user_id, 'account_action',
     'Custom theme approved',
     'Your uploaded theme is live for ' || coalesce(dur_h, 24) || ' hours',
     jsonb_build_object('custom_theme_id', row.id, 'expires_at', row.expires_at),
     me, 'custom_theme', row.id::text);

  return row;
end $$;
grant execute on function public.approve_custom_theme(uuid) to authenticated;

-- reject_custom_theme: refund coins + notify user
create or replace function public.reject_custom_theme(_id uuid, _reason text default null)
returns public.custom_themes
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  row public.custom_themes;
begin
  if not public.is_admin(me) then raise exception 'admin only'; end if;

  update public.custom_themes
     set status = 'rejected',
         reviewed_by = me,
         reviewed_at = now(),
         admin_notes = _reason
   where id = _id and status = 'pending'
   returning * into row;
  if row.id is null then raise exception 'request not found or already reviewed'; end if;

  update public.profiles set coins = coins + row.coins_paid, updated_at = now() where id = row.user_id;

  insert into public.notifications
    (user_id, kind, title, body, data, actor_id, entity_type, entity_id)
  values
    (row.user_id, 'account_action',
     'Custom theme rejected',
     coalesce(_reason, 'Your submission was not approved. Coins have been refunded.'),
     jsonb_build_object('custom_theme_id', row.id, 'refunded', row.coins_paid),
     me, 'custom_theme', row.id::text);

  return row;
end $$;
grant execute on function public.reject_custom_theme(uuid, text) to authenticated;

-- get_active_custom_theme: currently-active approved custom theme for a user
create or replace function public.get_active_custom_theme(_user uuid)
returns public.custom_themes
language sql stable security definer set search_path = public
as $$
  select *
    from public.custom_themes
   where user_id = _user
     and status = 'approved'
     and expires_at > now()
   order by approved_at desc
   limit 1
$$;
grant execute on function public.get_active_custom_theme(uuid) to authenticated, anon;

-- spin_daily_wheel: server-side weighted random draw + reward grant
create or replace function public.spin_daily_wheel()
returns public.daily_spins
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  cooldown int;
  enabled boolean;
  last_next timestamptz;
  total_w int;
  r int;
  cum int := 0;
  chosen public.spin_prizes%rowtype;
  amount int;
  reward_theme uuid;
  spin public.daily_spins;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select daily_spin_cooldown_hours, daily_spin_enabled
    into cooldown, enabled
    from public.app_settings where id = 'global';
  if not coalesce(enabled, true) then raise exception 'daily spin is currently disabled'; end if;

  select next_spin_at into last_next
    from public.daily_spins where user_id = me
   order by spun_at desc limit 1;
  if last_next is not null and last_next > now() then
    raise exception 'next spin available at %', last_next;
  end if;

  select coalesce(sum(weight), 0) into total_w from public.spin_prizes where is_active;
  if total_w <= 0 then raise exception 'no prizes configured'; end if;

  -- server-side weighted random
  r := 1 + floor(random() * total_w)::int;
  for chosen in
    select * from public.spin_prizes where is_active order by sort, id
  loop
    cum := cum + chosen.weight;
    if r <= cum then exit; end if;
  end loop;

  amount := chosen.min_amount
          + floor(random() * (greatest(chosen.max_amount - chosen.min_amount, 0) + 1))::int;
  reward_theme := null;

  if chosen.kind = 'coins' then
    update public.profiles set coins = coins + amount, updated_at = now() where id = me;
  elsif chosen.kind = 'diamonds' then
    update public.profiles set diamonds = coalesce(diamonds, 0) + amount, updated_at = now() where id = me;
  elsif chosen.kind in ('theme','frame') then
    select t.id into reward_theme
      from public.themes t
      join public.theme_categories c on c.id = t.category_id
     where t.is_active
       and lower(c.slug) = case when chosen.kind = 'frame' then 'frame' else 'theme' end
     order by random() limit 1;
    if reward_theme is not null then
      insert into public.user_themes (user_id, theme_id)
        values (me, reward_theme)
        on conflict (user_id, theme_id) do nothing;
    end if;
  end if;

  insert into public.daily_spins
    (user_id, prize_id, reward_kind, reward_amount, reward_label, granted_theme_id, next_spin_at)
  values
    (me, chosen.id, chosen.kind, amount, chosen.label, reward_theme,
     now() + (coalesce(cooldown, 24) || ' hours')::interval)
  returning * into spin;

  return spin;
end $$;
grant execute on function public.spin_daily_wheel() to authenticated;

create or replace function public.next_spin_at()
returns timestamptz language sql stable security definer set search_path = public
as $$
  select next_spin_at from public.daily_spins where user_id = auth.uid()
   order by spun_at desc limit 1
$$;
grant execute on function public.next_spin_at() to authenticated;

-- ---------- seed default prize pool (85% small / 13% medium / 2% jackpot) --
insert into public.spin_prizes (label, kind, min_amount, max_amount, weight, color, sort, duration_days) values
  ('50 Coins',      'coins',    50,   50,    30, '#4b1d3f', 1, null),
  ('100 Coins',     'coins',    100,  100,   25, '#7c3aed', 2, null),
  ('250 Coins',     'coins',    250,  250,   15, '#7c3aed', 3, null),
  ('500 Coins',     'coins',    500,  500,   10, '#a855f7', 4, null),
  ('1000 Coins',    'coins',    1000, 1000,   5, '#a855f7', 5, null),
  ('Random Frame',  'frame',    0,    0,      6, '#f59e0b', 6, 7),
  ('Random Theme',  'theme',    0,    0,      5, '#22c55e', 7, 3),
  ('50 Diamonds',   'diamonds', 25,   50,     3, '#06b6d4', 8, null),
  ('5000 Coins',    'coins',    5000, 5000,   1, '#ef4444', 9, null),
  ('100 Diamonds',  'diamonds', 75,   100,    1, '#fbbf24', 10, null)
on conflict do nothing;
