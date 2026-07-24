-- ============================================================================
-- 0166 — Room 20-minute grace period, owner reclaim, and end-room RPCs.
--
-- Lifecycle:
--   live               → host is present (heartbeat within 90s)
--   host_disconnected  → heartbeat missed OR host chose "leave temporarily";
--                        grace_period_until = now() + 20 minutes.
--                        Viewers stay; new joiners see "Host reconnecting".
--   ended              → host chose "end now", admin ended, or grace expired.
--
-- Reaper (cron every minute):
--   1) live + stale heartbeat  → host_disconnected, grace = now()+20min
--   2) host_disconnected + grace_period_until < now() → finalize + ended
-- ============================================================================

alter table public.live_rooms
  add column if not exists host_last_seen_at   timestamptz not null default now(),
  add column if not exists grace_period_until  timestamptz;

create index if not exists live_rooms_grace_idx
  on public.live_rooms (status, grace_period_until)
  where status = 'host_disconnected';

-- ---------------------------------------------------------------------------
-- host_room_heartbeat: host ping. Also resurrects a disconnected room.
-- ---------------------------------------------------------------------------
create or replace function public.host_room_heartbeat(_room_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  new_status text;
begin
  if me is null then raise exception 'not authenticated'; end if;

  update public.live_rooms
     set heartbeat_at       = now(),
         host_last_seen_at  = now(),
         status = case
                    when status = 'host_disconnected'
                     and (grace_period_until is null or grace_period_until > now())
                    then 'live'::room_status
                    else status
                  end,
         grace_period_until = case
                                when status = 'host_disconnected'
                                 and (grace_period_until is null or grace_period_until > now())
                                then null
                                else grace_period_until
                              end
   where id = _room_id
     and host_id = me
     and status in ('live','host_disconnected')
  returning status::text into new_status;

  return coalesce(new_status, 'not_found');
end $$;

grant execute on function public.host_room_heartbeat(uuid) to authenticated;

-- Back-compat: keep room_heartbeat name alive as a thin wrapper.
create or replace function public.room_heartbeat(_room_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  select public.host_room_heartbeat(_room_id); select null::void;
$$;

grant execute on function public.room_heartbeat(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- leave_room_as_host(_room_id, _end_now)
--   _end_now=true  → finalize gifts + status='ended'
--   _end_now=false → status='host_disconnected', grace_period_until = +20m
-- ---------------------------------------------------------------------------
create or replace function public.leave_room_as_host(_room_id uuid, _end_now boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  is_owner boolean;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select exists (
    select 1 from public.live_rooms
     where id = _room_id and host_id = me
  ) into is_owner;
  if not is_owner then raise exception 'not room host'; end if;

  if _end_now then
    perform public.finalize_room_gifts(_room_id);
    update public.live_rooms
       set status = 'ended',
           ended_at = now(),
           grace_period_until = null
     where id = _room_id
       and status <> 'ended';
    return 'ended';
  else
    update public.live_rooms
       set status = 'host_disconnected',
           host_last_seen_at = now(),
           grace_period_until = now() + interval '20 minutes'
     where id = _room_id
       and status = 'live';
    return 'host_disconnected';
  end if;
end $$;

grant execute on function public.leave_room_as_host(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- reclaim_room: host returns within grace window.
-- ---------------------------------------------------------------------------
create or replace function public.reclaim_room(_room_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  ok boolean;
begin
  if me is null then raise exception 'not authenticated'; end if;

  update public.live_rooms
     set status = 'live',
         heartbeat_at = now(),
         host_last_seen_at = now(),
         grace_period_until = null
   where id = _room_id
     and host_id = me
     and status = 'host_disconnected'
     and (grace_period_until is null or grace_period_until > now())
  returning true into ok;

  if not coalesce(ok, false) then
    raise exception 'grace period expired or not room host';
  end if;
  return 'live';
end $$;

grant execute on function public.reclaim_room(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- end_room: host or admin explicitly ends. Finalizes gifts.
-- ---------------------------------------------------------------------------
create or replace function public.end_room(_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  allowed boolean;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select (host_id = me) or public.is_admin(me)
    into allowed
    from public.live_rooms
   where id = _room_id;
  if not coalesce(allowed, false) then raise exception 'forbidden'; end if;

  perform public.finalize_room_gifts(_room_id);
  update public.live_rooms
     set status = 'ended',
         ended_at = now(),
         grace_period_until = null
   where id = _room_id
     and status <> 'ended';
end $$;

grant execute on function public.end_room(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_my_recoverable_room: home page priority card query.
--   Returns the caller's currently-live or grace-window room, if any.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_recoverable_room()
returns table (
  id uuid,
  title text,
  cover_url text,
  room_type text,
  status text,
  grace_period_until timestamptz,
  viewer_count int
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.title, r.cover_url, r.room_type::text, r.status::text,
         r.grace_period_until, r.viewer_count
    from public.live_rooms r
   where r.host_id = auth.uid()
     and r.status in ('live','host_disconnected')
     and (r.grace_period_until is null or r.grace_period_until > now())
   order by r.created_at desc
   limit 1
$$;

grant execute on function public.get_my_recoverable_room() to authenticated;

-- ---------------------------------------------------------------------------
-- Updated reaper: 2-phase.
-- ---------------------------------------------------------------------------
create or replace function public.close_stale_rooms()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n1 integer := 0;
  n2 integer := 0;
  r record;
begin
  -- Phase 1: live rooms whose host heartbeat died → enter grace.
  with moved as (
    update public.live_rooms
       set status = 'host_disconnected',
           grace_period_until = now() + interval '20 minutes'
     where status = 'live'
       and heartbeat_at < now() - interval '90 seconds'
    returning id
  )
  select count(*) into n1 from moved;

  -- Phase 2: grace expired → finalize gifts, then mark ended.
  for r in
    select id from public.live_rooms
     where status = 'host_disconnected'
       and grace_period_until is not null
       and grace_period_until < now()
  loop
    begin
      perform public.finalize_room_gifts(r.id);
    exception when others then
      -- keep going; log via NOTICE
      raise notice 'finalize_room_gifts failed for %: %', r.id, sqlerrm;
    end;
    update public.live_rooms
       set status = 'ended',
           ended_at = now(),
           grace_period_until = null
     where id = r.id
       and status = 'host_disconnected';
    n2 := n2 + 1;
  end loop;

  return n1 + n2;
end $$;

grant execute on function public.close_stale_rooms() to service_role;

-- ---------------------------------------------------------------------------
-- Hide host_disconnected rooms from public listings.
-- ---------------------------------------------------------------------------
create or replace function public.list_live_rooms_ranked(
  _limit int default 30,
  _offset int default 0
) returns table (
  id uuid,
  title text,
  cover_url text,
  room_type text,
  viewer_count int,
  is_locked boolean,
  host_id uuid,
  host_username text,
  host_avatar text,
  coin_score bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id, r.title, r.cover_url, r.room_type::text, r.viewer_count,
    r.is_locked, r.host_id, p.username, p.avatar,
    coalesce(pop.coin_score, 0)::bigint
  from public.live_rooms r
  left join public.profiles p          on p.id = r.host_id
  left join public.room_popularity pop on pop.room_id = r.id
  where r.status = 'live'
  order by coalesce(pop.coin_score, 0) desc, r.viewer_count desc, r.created_at desc
  limit greatest(1, least(_limit, 100))
  offset greatest(0, _offset)
$$;

grant execute on function public.list_live_rooms_ranked(int, int) to anon, authenticated;

notify pgrst, 'reload schema';
