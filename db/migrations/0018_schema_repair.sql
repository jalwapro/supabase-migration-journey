-- ============================================================================
-- Jalwa — Schema repair: guarantees every column the app queries exists.
-- Safe to run multiple times (all IF NOT EXISTS / ON CONFLICT guarded).
-- Run this in Supabase Dashboard → SQL Editor if any /rank or /splash page
-- returns 400 "column does not exist".
-- ============================================================================

-- profiles: vip_level used by ranking + VIP UI
alter table public.profiles
  add column if not exists vip_level integer not null default 0,
  add column if not exists xp bigint not null default 0;

-- app_settings: splash columns used by /splash route
alter table public.app_settings
  add column if not exists splash_enabled boolean not null default true,
  add column if not exists splash_image text,
  add column if not exists splash_duration integer not null default 5,
  add column if not exists splash_video text,
  add column if not exists splash_video_poster text;

-- Ensure singleton settings row exists so .eq('id','global') resolves.
insert into public.app_settings (id) values ('global') on conflict (id) do nothing;

-- Sanity grants (idempotent) — Data API needs these regardless of RLS.
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;
grant select on public.app_settings to anon, authenticated;
grant all on public.profiles to service_role;
grant all on public.app_settings to service_role;
