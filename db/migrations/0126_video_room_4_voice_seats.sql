-- Video rooms: 4 voice seats (indices 2..5) in addition to host (0) + co-host (1).
-- 1) Ensure video rooms have seat_count >= 6 so seats 2..5 are valid.
-- 2) Harden take_seat to reject stealing an occupied seat.
-- 3) Add take_available_voice_seat() RPC for one-tap auto-assign into 2..5.

------------------------------------------------------------------------------
-- 1) Backfill + default for video rooms
------------------------------------------------------------------------------
update public.live_rooms
   set seat_count = 6
 where room_type = 'video'
   and seat_count < 6;

------------------------------------------------------------------------------
-- 2) Harden take_seat — no stealing an occupied seat (host can still reclaim
--    seat 0 via host_reclaim_video_seat / dedicated flows)
------------------------------------------------------------------------------
create or replace function public.take_seat(_room_id uuid, _seat_index int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me       uuid := auth.uid();
  r_host   uuid;
  r_locked int[];
  r_seats  int;
  occupant uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select host_id, locked_seats, seat_count
    into r_host, r_locked, r_seats
    from public.live_rooms where id = _room_id;
  if r_host is null then raise exception 'room not found'; end if;

  if _seat_index < 0 or _seat_index >= r_seats then
    raise exception 'invalid seat index';
  end if;

  -- Seat 0 = host only
  if _seat_index = 0 and me <> r_host then
    raise exception 'Seat 1 is reserved for the host';
  end if;

  -- Locked seat: only host / moderator can occupy
  if _seat_index = any(coalesce(r_locked, '{}'::int[])) then
    if me <> r_host and not exists (
      select 1 from public.room_members
      where room_id = _room_id and user_id = me and is_moderator = true
    ) then
      raise exception 'Seat is locked';
    end if;
  end if;

  -- Occupied? Reject unless it's already me.
  select user_id into occupant
    from public.room_members
   where room_id = _room_id and seat_index = _seat_index;
  if occupant is not null and occupant <> me then
    raise exception 'Seat is taken';
  end if;

  -- Host moving off seat 0 → free seat 0
  if me = r_host and _seat_index <> 0 then
    update public.room_members set seat_index = null
     where room_id = _room_id and seat_index = 0 and user_id = me;
  end if;

  insert into public.room_members (room_id, user_id, seat_index)
    values (_room_id, me, _seat_index)
    on conflict (room_id, user_id) do update
      set seat_index = excluded.seat_index;
end $$;

grant execute on function public.take_seat(uuid, int) to authenticated;

------------------------------------------------------------------------------
-- 3) Auto-assign first empty voice seat (2..5 for video, 1..seat_count-1 for voice)
------------------------------------------------------------------------------
create or replace function public.take_available_voice_seat(_room_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  me         uuid := auth.uid();
  r_type     text;
  r_seats    int;
  r_locked   int[];
  start_idx  int;
  target_idx int;
  i          int;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select room_type::text, seat_count, coalesce(locked_seats, '{}'::int[])
    into r_type, r_seats, r_locked
    from public.live_rooms where id = _room_id;
  if r_seats is null then raise exception 'room not found'; end if;

  -- Video rooms: voice seats live at 2..5 (host=0, co-host=1)
  -- Voice rooms: any seat 1..seat_count-1
  start_idx := case when r_type = 'video' then 2 else 1 end;

  -- Already seated? Return current index.
  select seat_index into target_idx
    from public.room_members
   where room_id = _room_id and user_id = me and seat_index is not null;
  if target_idx is not null then
    return target_idx;
  end if;

  -- Find first empty, unlocked seat starting from start_idx
  for i in start_idx..(r_seats - 1) loop
    if i = any(r_locked) then continue; end if;
    if not exists (
      select 1 from public.room_members
       where room_id = _room_id and seat_index = i
    ) then
      target_idx := i;
      exit;
    end if;
  end loop;

  if target_idx is null then
    raise exception 'No available seat';
  end if;

  insert into public.room_members (room_id, user_id, seat_index)
    values (_room_id, me, target_idx)
    on conflict (room_id, user_id) do update
      set seat_index = excluded.seat_index;

  return target_idx;
end $$;

grant execute on function public.take_available_voice_seat(uuid) to authenticated;
