-- Real seat-capacity changes for voice rooms.
-- Seat 0 belongs to the host. Non-host seated users are compacted to 1..N
-- whenever capacity is reduced so users are never left on hidden seat numbers.
create or replace function public.update_voice_room_seat_count(_room_id uuid, _seat_count integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  r_host uuid;
  old_count integer;
  next_count integer;
  occupied integer;
  member_ids uuid[];
  member_id uuid;
  new_index integer := 1;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if _seat_count is null or _seat_count not in (4,8,12,16,20) then
    raise exception 'seat count must be 4, 8, 12, 16, or 20';
  end if;
  next_count := _seat_count;

  select r.host_id, r.seat_count
    into r_host, old_count
    from public.live_rooms r
   where r.id = _room_id
   for update;

  if r_host is null then
    raise exception 'room not found';
  end if;
  if r_host <> me then
    raise exception 'only the host can change room seats';
  end if;

  select count(*)::integer
    into occupied
    from public.room_members m
   where m.room_id = _room_id
     and m.seat_index is not null;

  if occupied > next_count then
    raise exception 'cannot reduce capacity below % occupied users', occupied;
  end if;

  -- Seat 0 is reserved for the host. On a reduction, compact all other
  -- occupied users into consecutive positions 1..N, preserving their
  -- current seat order so no participant is silently removed.
  if old_count > next_count then
    select array_agg(m.user_id order by m.seat_index asc, m.user_id asc)
      into member_ids
      from public.room_members m
     where m.room_id = _room_id
       and m.seat_index is not null
       and m.user_id <> r_host;

    -- First move to negative temporary positions so a unique seat constraint
    -- cannot collide while positions are being reassigned.
    update public.room_members rm
       set seat_index = -1 - ranked.row_number_value
      from (
        select user_id,
               row_number() over (order by seat_index asc, user_id asc) - 1 as row_number_value
          from public.room_members
         where room_id = _room_id
           and seat_index is not null
           and user_id <> r_host
      ) ranked
     where rm.room_id = _room_id
       and rm.user_id = ranked.user_id;

    if member_ids is not null then
      foreach member_id in array member_ids loop
        update public.room_members
           set seat_index = new_index,
               seated_at = now()
         where room_id = _room_id
           and user_id = member_id;
        new_index := new_index + 1;
      end loop;
    end if;
  end if;

  update public.live_rooms
     set seat_count = next_count,
         updated_at = now()
   where id = _room_id;

  return next_count;
end;
$$;

revoke all on function public.update_voice_room_seat_count(uuid, integer) from public;
grant execute on function public.update_voice_room_seat_count(uuid, integer) to authenticated;
