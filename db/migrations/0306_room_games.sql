-- 0306_room_games.sql — admin-managed catalogue of externally-hosted room games
-- (Vercel/GitHub Pages deployments, or static bundles in the R2 bucket),
-- shown as PNG buttons in the room's Games popup and opened inline via iframe.
begin;

create table if not exists public.room_games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  icon_url text,               -- PNG uploaded via the admin panel (R2)
  game_url text not null,      -- the hosted game's URL, opened in an <iframe>
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_room_games_enabled on public.room_games (enabled, sort_order);

grant select on public.room_games to anon, authenticated;
grant all on public.room_games to service_role;
alter table public.room_games enable row level security;

drop policy if exists "room_games read" on public.room_games;
create policy "room_games read" on public.room_games
  for select using (enabled or public.is_admin(auth.uid()));

drop policy if exists "room_games admin" on public.room_games;
create policy "room_games admin" on public.room_games
  to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

commit;
