-- =============================================================
-- Random PK Matchmaking (TikTok-style)
-- Hosts join a queue with a duration preference. When two hosts
-- with the same duration are waiting, they are auto-paired into
-- an active pk_matches row (no manual accept — joining IS consent).
-- =============================================================

create table if not exists public.pk_match_queue (
  host_id       uuid primary key references auth.users(id) on delete cascade,
  room_id       uuid not null references public.live_rooms(id) on delete cascade,
  duration_sec  int  not null check (duration_sec in (180, 300, 600)),
  created_at    timestamptz not null default now()
);

create index if not exists idx_pk_queue_dur on public.pk_match_queue(duration_sec, created_at);

grant select on public.pk_match_queue to authenticated;
grant all    on public.pk_match_queue to service_role;

alter table public.pk_match_queue enable row level security;

drop policy if exists "pk queue: self read" on public.pk_match_queue;
create policy "pk queue: self read"
  on public.pk_match_queue for select to authenticated
  using (auth.uid() = host_id);

-- Join random queue. Returns a pk_matches row if instantly paired,
-- else NULL (caller polls / listens on live_rooms.active_pk_match_id).
create or replace function public.pk_join_random_queue(_duration_sec int)
returns public.pk_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  my_room public.live_rooms;
  opp record;
  opp_room public.live_rooms;
  m public.pk_matches;
begin
  if me is null then raise exception 'auth required'; end if;
  if _duration_sec not in (180, 300, 600) then raise exception 'invalid duration'; end if;

  select * into my_room from public.live_rooms
    where host_id = me and status = 'live'
    order by created_at desc limit 1;
  if my_room.id is null then raise exception 'you must be live to matchmake'; end if;
  if my_room.active_pk_match_id is not null then raise exception 'already in a PK match'; end if;

  -- Try to grab an opponent: oldest queued host with same duration whose room is still live & free.
  select q.host_id, q.room_id
    into opp
    from public.pk_match_queue q
    join public.live_rooms lr on lr.id = q.room_id
   where q.host_id <> me
     and q.duration_sec = _duration_sec
     and lr.status = 'live'
     and lr.active_pk_match_id is null
   order by q.created_at asc
   for update skip locked
   limit 1;

  if opp.host_id is not null then
    -- pair them: remove both queue entries, create match, flag both rooms
    delete from public.pk_match_queue where host_id in (me, opp.host_id);

    select * into opp_room from public.live_rooms where id = opp.room_id;

    insert into public.pk_matches(host_a, host_b, room_a, room_b, duration_sec, ends_at)
    values (opp.host_id, me, opp_room.id, my_room.id, _duration_sec, now() + make_interval(secs => _duration_sec))
    returning * into m;

    update public.live_rooms set active_pk_match_id = m.id where id in (m.room_a, m.room_b);
    return m;
  end if;

  -- No opponent yet — enqueue self (upsert to allow duration change).
  insert into public.pk_match_queue(host_id, room_id, duration_sec)
  values (me, my_room.id, _duration_sec)
  on conflict (host_id) do update
     set room_id = excluded.room_id,
         duration_sec = excluded.duration_sec,
         created_at = now();

  return null;
end;
$$;

grant execute on function public.pk_join_random_queue(int) to authenticated;

-- Leave the random queue (cancel search)
create or replace function public.pk_leave_queue()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.pk_match_queue where host_id = auth.uid();
$$;

grant execute on function public.pk_leave_queue() to authenticated;

-- Realtime for queue (so we can show "N hosts searching" if desired later)
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pk_match_queue') then
    execute 'alter publication supabase_realtime add table public.pk_match_queue';
  end if;
end$$;
alter table public.pk_match_queue replica identity full;
