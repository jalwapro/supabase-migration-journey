-- Voice-room capacity is any whole number from 4 through 20.
-- Seat 1 is permanently reserved for the host; participant seats are 2..capacity.
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
  occupied_participants integer;
  member_ids uuid[];
  member_id uuid;
  new_index integer := 2;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if _seat_count is null or _seat_count < 4 or _seat_count > 20 then
    raise exception 'seat count must be between 4 and 20';
  end if;

  select r.host_id, r.seat_count into r_host, old_count
    from public.live_rooms r where r.id = _room_id for update;
  if r_host is null then raise exception 'room not found'; end if;
  if r_host <> me then raise exception 'only the host can change room seats'; end if;

  update public.room_members
     set seat_index = 1, seated_at = coalesce(seated_at, now())
   where room_id = _room_id and user_id = r_host;

  select count(*)::integer into occupied_participants
    from public.room_members m
   where m.room_id = _room_id and m.user_id <> r_host and m.seat_index is not null;
  if occupied_participants > (_seat_count - 1) then
    raise exception 'cannot reduce capacity below % occupied participants', occupied_participants;
  end if;

  if old_count is distinct from _seat_count then
    update public.room_members rm
       set seat_index = -100000 - ranked.rn
      from (
        select user_id, row_number() over (order by seat_index asc, user_id asc) as rn
          from public.room_members
         where room_id = _room_id and user_id <> r_host and seat_index is not null
      ) ranked
     where rm.room_id = _room_id and rm.user_id = ranked.user_id;

    select array_agg(user_id order by rn) into member_ids
      from (
        select user_id, row_number() over (order by seat_index asc, user_id asc) as rn
          from public.room_members
         where room_id = _room_id and user_id <> r_host and seat_index < 0
      ) ordered;

    if member_ids is not null then
      foreach member_id in array member_ids loop
        update public.room_members set seat_index = new_index, seated_at = now()
         where room_id = _room_id and user_id = member_id;
        new_index := new_index + 1;
      end loop;
    end if;
  end if;

  update public.live_rooms set seat_count = _seat_count, updated_at = now() where id = _room_id;
  return _seat_count;
end;
$$;
revoke all on function public.update_voice_room_seat_count(uuid, integer) from public;
grant execute on function public.update_voice_room_seat_count(uuid, integer) to authenticated;
