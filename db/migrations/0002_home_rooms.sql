-- ============================================================================
-- Jalwa — Phase 2: Categories, Banners, Live Rooms, Room Members, Messages,
--                  App Settings (Agora keys & other admin-editable config)
-- ============================================================================

-- ---------- Enums ----------------------------------------------------------
do $$ begin
  create type public.room_type as enum ('voice', 'video');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.room_status as enum ('live', 'ended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.message_kind as enum ('chat', 'gift', 'system', 'join', 'leave');
exception when duplicate_object then null; end $$;

-- ---------- categories -----------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;

alter table public.categories enable row level security;

drop policy if exists "categories are public" on public.categories;
create policy "categories are public"
  on public.categories for select
  using (true);

drop policy if exists "admins manage categories" on public.categories;
create policy "admins manage categories"
  on public.categories for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ---------- banners --------------------------------------------------------
create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  title text,
  image_url text not null,
  link_url text,
  sort_order int not null default 0,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

grant select on public.banners to anon, authenticated;
grant all on public.banners to service_role;

alter table public.banners enable row level security;

drop policy if exists "banners are public" on public.banners;
create policy "banners are public"
  on public.banners for select
  using (
    active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

drop policy if exists "admins manage banners" on public.banners;
create policy "admins manage banners"
  on public.banners for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ---------- live_rooms -----------------------------------------------------
create table if not exists public.live_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  cover_url text,
  category_id uuid references public.categories(id) on delete set null,
  room_type public.room_type not null default 'voice',
  status public.room_status not null default 'live',
  agora_channel text not null unique,
  seat_count int not null default 8,
  viewer_count int not null default 0,
  is_locked boolean not null default false,
  password text,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists idx_live_rooms_status on public.live_rooms(status, created_at desc);
create index if not exists idx_live_rooms_category on public.live_rooms(category_id, status);
create index if not exists idx_live_rooms_host on public.live_rooms(host_id);

grant select on public.live_rooms to anon, authenticated;
grant insert, update on public.live_rooms to authenticated;
grant all on public.live_rooms to service_role;

alter table public.live_rooms enable row level security;

drop policy if exists "live rooms are public" on public.live_rooms;
create policy "live rooms are public"
  on public.live_rooms for select
  using (true);

drop policy if exists "authenticated can create rooms" on public.live_rooms;
create policy "authenticated can create rooms"
  on public.live_rooms for insert
  to authenticated
  with check (auth.uid() = host_id);

drop policy if exists "host or admin can update room" on public.live_rooms;
create policy "host or admin can update room"
  on public.live_rooms for update
  to authenticated
  using (auth.uid() = host_id or public.is_admin(auth.uid()))
  with check (auth.uid() = host_id or public.is_admin(auth.uid()));

drop policy if exists "admin can delete room" on public.live_rooms;
create policy "admin can delete room"
  on public.live_rooms for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- ---------- room_members ---------------------------------------------------
create table if not exists public.room_members (
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seat_index int,           -- null = viewer, 0..N-1 = on-seat
  is_muted boolean not null default false,
  is_video boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists idx_room_members_user on public.room_members(user_id);
create unique index if not exists uniq_room_seat
  on public.room_members(room_id, seat_index)
  where seat_index is not null;

grant select on public.room_members to anon, authenticated;
grant insert, update, delete on public.room_members to authenticated;
grant all on public.room_members to service_role;

alter table public.room_members enable row level security;

drop policy if exists "room members visible to all" on public.room_members;
create policy "room members visible to all"
  on public.room_members for select
  using (true);

drop policy if exists "user can join room" on public.room_members;
create policy "user can join room"
  on public.room_members for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user updates own membership" on public.room_members;
create policy "user updates own membership"
  on public.room_members for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "host or self can remove" on public.room_members;
create policy "host or self can remove"
  on public.room_members for delete
  to authenticated
  using (
    auth.uid() = user_id
    or public.is_admin(auth.uid())
    or exists (
      select 1 from public.live_rooms r
      where r.id = room_members.room_id and r.host_id = auth.uid()
    )
  );

-- ---------- room_messages --------------------------------------------------
create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  kind public.message_kind not null default 'chat',
  text text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_room_messages_room on public.room_messages(room_id, created_at desc);

grant select on public.room_messages to anon, authenticated;
grant insert on public.room_messages to authenticated;
grant all on public.room_messages to service_role;

alter table public.room_messages enable row level security;

drop policy if exists "room messages public read" on public.room_messages;
create policy "room messages public read"
  on public.room_messages for select
  using (true);

drop policy if exists "auth users can post messages" on public.room_messages;
create policy "auth users can post messages"
  on public.room_messages for insert
  to authenticated
  with check (auth.uid() = user_id or user_id is null);

drop policy if exists "admins moderate messages" on public.room_messages;
create policy "admins moderate messages"
  on public.room_messages for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- ---------- app_settings (admin-editable keys: Agora, etc.) ---------------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  is_secret boolean not null default false,   -- true → not readable by anon
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

grant select on public.app_settings to authenticated;
grant all on public.app_settings to service_role;

alter table public.app_settings enable row level security;

-- Public keys (is_secret=false) readable by anyone signed in — e.g. Agora App ID
drop policy if exists "public settings readable" on public.app_settings;
create policy "public settings readable"
  on public.app_settings for select
  to authenticated
  using (is_secret = false);

drop policy if exists "admins read all settings" on public.app_settings;
create policy "admins read all settings"
  on public.app_settings for select
  to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "admins write settings" on public.app_settings;
create policy "admins write settings"
  on public.app_settings for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.update_updated_at_column();

-- ---------- Seed --------------------------------------------------------
insert into public.categories (name, slug, icon, sort_order) values
  ('For You',    'foryou',    '✨', 0),
  ('Trending',   'trending',  '🔥', 1),
  ('Party',      'party',     '🎉', 2),
  ('Music',      'music',     '🎵', 3),
  ('Chat',       'chat',      '💬', 4),
  ('Gaming',     'gaming',    '🎮', 5),
  ('PK Battle',  'pk',        '⚔️', 6),
  ('New Host',   'newhost',   '🌟', 7)
on conflict (slug) do nothing;

-- Placeholder settings rows so admin form has slots to fill.
insert into public.app_settings (key, value, description, is_secret) values
  ('agora',      '{"appId":"","appCertificate":""}'::jsonb, 'Agora App ID + App Certificate for live rooms', true),
  ('branding',   '{"appName":"Jalwa","tagline":"Create · Share · Shine"}'::jsonb, 'App name and tagline shown in headers', false),
  ('payments',   '{"jazzcash":"","easypaisa":"","bankName":"","bankAccount":"","bankTitle":"","crypto":""}'::jsonb, 'Manual recharge deposit accounts', true),
  ('economy',    '{"pkrPerCoin":1,"pkrPerDiamond":1,"hostGiftShare":0.6}'::jsonb, 'Coin/diamond conversion and host share', false)
on conflict (key) do nothing;
