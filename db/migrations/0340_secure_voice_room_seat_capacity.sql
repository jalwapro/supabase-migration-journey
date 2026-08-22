-- Secure voice-room seat capacity changes.
-- The host may only select one of the supported room layouts.
-- The operation is server-side and prevents reducing capacity below occupied seats.
create or replace function public.update_voice_room_seat_count(_room_id uuid, _seat_count integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  host uuid;
  current_count integer;
  occupied integer;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if _seat_count is null or _seat_count not in (4,8,12,16,20) then
    raise exception 'seat count must be 4, 8, 12, 16, or 20';
  end if;
  select host_id, seat_count into host, current_count
    from public.live_rooms where id = _room_id for update;
  if host is null then raise exception 'room not found'; end if;
  if host <> me then raise exception 'only the host can change room seat capacity'; end if;
  if current_count = _seat_count then return _seat_count; end if;
  select count(*)::integer into occupied
    from public.room_members where room_id = _room_id and seat_index is not null;
  if occupied > _seat_count then
    raise exception 'cannot reduce capacity below % occupied seats', occupied;
  end if;
  update public.live_rooms set seat_count = _seat_count where id = _room_id;
  return _seat_count;
end;
$$;
revoke all on function public.update_voice_room_seat_count(uuid, integer) from public;
grant execute on function public.update_voice_room_seat_count(uuid, integer) to authenticated;
