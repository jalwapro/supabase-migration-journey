-- Secure host-only seat capacity update for live voice rooms.
-- Seat 0 is the host; seat_count is the total room capacity including the host.
create or replace function public.update_voice_room_seat_count(
  _room_id uuid,
  _seat_count integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  host_id uuid;
  status_text text;
  occupied integer;
  next_count integer;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  select r.host_id, r.status::text
    into host_id, status_text
    from public.live_rooms r
   where r.id = _room_id
   for update;

  if host_id is null then
    raise exception 'room not found';
  end if;
  if host_id <> me then
    raise exception 'only the host can change room seats';
  end if;
  if status_text <> 'live' then
    raise exception 'room is not live';
  end if;

  next_count := greatest(2, least(20, floor(coalesce(_seat_count, 8))::integer));

  select count(*)::integer
    into occupied
    from public.room_members m
   where m.room_id = _room_id
     and m.seat_index is not null;

  if next_count < greatest(2, occupied) then
    raise exception 'cannot reduce below % occupied seats', occupied;
  end if;

  update public.live_rooms
     set seat_count = next_count,
         updated_at = now()
   where id = _room_id
     and host_id = me;

  return next_count;
end;
$$;

grant execute on function public.update_voice_room_seat_count(uuid, integer) to authenticated;
