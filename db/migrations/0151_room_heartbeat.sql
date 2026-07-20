-- ============================================================================
-- 0151 — Room heartbeat + stale-room auto-close
-- Fixes: host closes the app / loses network → room stays "live" forever.
-- Approach: host pings every ~25s; a cron job ends rooms whose last heartbeat
--           is older than 90s. Short offline windows (up to 90s) are tolerated.
-- ============================================================================

alter table public.live_rooms
  add column if not exists heartbeat_at timestamptz not null default now();

create index if not exists live_rooms_heartbeat_idx
  on public.live_rooms (status, heartbeat_at)
  where status = 'live';

-- Host-only heartbeat RPC ---------------------------------------------------
create or replace function public.room_heartbeat(_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  update public.live_rooms
     set heartbeat_at = now()
   where id = _room_id
     and host_id = me
     and status = 'live';
end $$;

grant execute on function public.room_heartbeat(uuid) to authenticated;

-- Stale room reaper (run by cron) -------------------------------------------
create or replace function public.close_stale_rooms()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  closed_count integer := 0;
begin
  with dead as (
    update public.live_rooms
       set status = 'ended',
           ended_at = now()
     where status = 'live'
       and heartbeat_at < now() - interval '90 seconds'
    returning id
  )
  select count(*) into closed_count from dead;
  return closed_count;
end $$;

grant execute on function public.close_stale_rooms() to service_role;

-- Schedule via pg_cron if available (idempotent) ----------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('close-stale-rooms')
      where exists (select 1 from cron.job where jobname = 'close-stale-rooms');
    perform cron.schedule(
      'close-stale-rooms',
      '* * * * *',
      $cron$ select public.close_stale_rooms(); $cron$
    );
  end if;
end $$;

notify pgrst, 'reload schema';
