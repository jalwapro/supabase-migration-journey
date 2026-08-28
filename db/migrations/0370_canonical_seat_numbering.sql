-- JALWA Voice Room: canonical 1-based seat numbering.
-- Voice rooms: host = seat 1, participants = seats 2..seat_count.
-- Video rooms retain their existing 0-based internal tile convention.
-- This migration repairs existing voice-room member seat data and hardens the
-- two seat-claim RPCs against the old 0..seat_count-1 convention.

DO $$
declare
  r record;
  m record;
  participant_count integer;
  next_seat integer;
begin
  -- Validate first so a bad room aborts the migration before any data repair.
  for r in
    select id, host_id, seat_count
      from public.live_rooms
     where room_type::text = 'voice'
  loop
    select count(*)::integer into participant_count
      from public.room_members rm
     where rm.room_id = r.id
       and rm.seat_index is not null
       and rm.user_id <> r.host_id;

    if participant_count > greatest(coalesce(r.seat_count, 8) - 1, 0) then
      raise exception 'voice room % has % seated participants but capacity is %',
        r.id, participant_count, coalesce(r.seat_count, 8);
    end if;
  end loop;

  -- Normalize every occupied voice seat without violating the unique seat index.
  -- Negative temporary values are outside the canonical human-facing range.
  for r in
    select id, host_id, seat_count
      from public.live_rooms
     where room_type::text = 'voice'
  loop
    update public.room_members rm
       set seat_index = -100000 - ranked.rn
      from (
        select user_id,
               row_number() over (
                 order by (user_id = r.host_id) desc, seat_index asc, user_id asc
               ) as rn
          from public.room_members
         where room_id = r.id
           and seat_index is not null
      ) ranked
     where rm.room_id = r.id
       and rm.user_id = ranked.user_id;

    next_seat := 2;

    for m in
      select rm.user_id, rm.seat_index
        from public.room_members rm
       where rm.room_id = r.id
         and rm.seat_index < 0
       order by rm.seat_index desc
    loop
      if m.user_id = r.host_id then
        update public.room_members
           set seat_index = 1,
               seated_at = coalesce(seated_at, now())
         where room_id = r.id and user_id = m.user_id;
      else
        update public.room_members
           set seat_index = next_seat,
               seated_at = coalesce(seated_at, now())
         where room_id = r.id and user_id = m.user_id;
        next_seat := next_seat + 1;
      end if;
    end loop;
  end loop;
end $$;

CREATE OR REPLACE FUNCTION public.take_seat(_room_id uuid, _seat_index integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  me uuid := auth.uid();
  r_host uuid;
  r_status text;
  r_type text;
  r_locked int[];
  r_seats int;
  occupant uuid;
  am_mod boolean;
  grant_id uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;

  perform public._room_seat_lock(_room_id);

  select host_id, status::text, room_type::text, locked_seats, seat_count
    into r_host, r_status, r_type, r_locked, r_seats
    from public.live_rooms where id = _room_id;
  if r_host is null then raise exception 'room not found'; end if;
  if r_status <> 'live' then raise exception 'room is not live'; end if;

  -- Voice rooms use human-visible 1..seat_count. Video keeps its existing
  -- internal 0-based tile convention.
  if r_type = 'voice' then
    if _seat_index < 1 or _seat_index > coalesce(r_seats, 8) then
      raise exception 'invalid voice seat number';
    end if;
    if me = r_host and _seat_index <> 1 then
      raise exception 'Host must remain on Seat 1';
    end if;
    if _seat_index = 1 and me <> r_host then
      raise exception 'Seat 1 is reserved for the host';
    end if;
  else
    if _seat_index < 0 or _seat_index >= coalesce(r_seats, 8) then
      raise exception 'invalid seat index';
    end if;
  end if;

  if _seat_index = any(coalesce(r_locked, '{}'::int[])) then
    if me <> r_host and not exists (
      select 1 from public.room_members
       where room_id = _room_id and user_id = me and is_moderator = true
    ) then
      raise exception 'Seat is locked';
    end if;
  end if;

  select user_id into occupant
    from public.room_members
   where room_id = _room_id and seat_index = _seat_index;
  if occupant is not null and occupant <> me then
    raise exception 'Seat is already occupied';
  end if;

  if me <> r_host then
    select coalesce(is_moderator, false) into am_mod
      from public.room_members
     where room_id = _room_id and user_id = me;

    if not coalesce(am_mod, false) then
      update public.seat_invites
         set status = 'used', consumed_at = now()
       where id = (
         select id from public.seat_invites
          where room_id = _room_id
            and to_user = me
            and status = 'accepted'
            and consumed_at is null
            and (seat_index is null or seat_index = _seat_index)
          order by responded_at desc nulls last, created_at desc
          limit 1
          for update skip locked
       )
      returning id into grant_id;

      if grant_id is null then
        update public.seat_requests
           set status = 'used', consumed_at = now()
         where id = (
           select id from public.seat_requests
            where room_id = _room_id
              and from_user = me
              and status = 'accepted'
              and consumed_at is null
              and (seat_index is null or seat_index = _seat_index)
            order by responded_at desc nulls last, created_at desc
            limit 1
            for update skip locked
         )
        returning id into grant_id;
      end if;

      if grant_id is null then
        raise exception 'Host approval required — raise hand first';
      end if;
    end if;
  end if;

  insert into public.room_members (room_id, user_id, seat_index, seated_at)
    values (_room_id, me, _seat_index, now())
    on conflict (room_id, user_id) do update
      set seat_index = excluded.seat_index,
          seated_at = now();
end;
$$;

CREATE OR REPLACE FUNCTION public.take_available_voice_seat(_room_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  me uuid := auth.uid();
  r_host uuid;
  r_status text;
  r_type text;
  r_seats int;
  r_locked int[];
  start_idx int;
  target_idx int;
  i int;
begin
  if me is null then raise exception 'not authenticated'; end if;
  perform public._room_seat_lock(_room_id);

  select host_id, status::text, room_type::text, seat_count,
         coalesce(locked_seats, '{}'::int[])
    into r_host, r_status, r_type, r_seats, r_locked
    from public.live_rooms where id = _room_id;
  if r_host is null then raise exception 'room not found'; end if;
  if r_status <> 'live' then raise exception 'room is not live'; end if;
  if r_type <> 'voice' then raise exception 'not a voice room'; end if;

  select seat_index into target_idx
    from public.room_members
   where room_id = _room_id and user_id = me and seat_index is not null;
  if target_idx is not null then
    return target_idx;
  end if;

  start_idx := case when me = r_host then 1 else 2 end;

  for i in start_idx..coalesce(r_seats, 8) loop
    if i = any(r_locked) then continue; end if;
    if not exists (
      select 1 from public.room_members
       where room_id = _room_id and seat_index = i
    ) then
      target_idx := i;
      exit;
    end if;
  end loop;

  if target_idx is null then raise exception 'No available seat'; end if;

  insert into public.room_members (room_id, user_id, seat_index, seated_at)
    values (_room_id, me, target_idx, now())
    on conflict (room_id, user_id) do update
      set seat_index = excluded.seat_index,
          seated_at = now();

  return target_idx;
end;
$$;

REVOKE ALL ON FUNCTION public.take_seat(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.take_seat(uuid, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.take_available_voice_seat(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.take_available_voice_seat(uuid) TO authenticated;
