-- ============================================================================
-- Host reclaim video seat (seat 0)
-- Host taps "Return to host seat" → atomically swap: current occupant of
-- seat 0 moves to host's current seat (if any) or becomes an audience viewer,
-- host takes seat 0.
-- ============================================================================

create or replace function public.host_reclaim_video_seat(_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  r_host uuid;
  my_seat int;
  cur_occupant uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select host_id into r_host from public.live_rooms where id = _room_id;
  if r_host is null then raise exception 'room not found'; end if;
  if me <> r_host then raise exception 'only host can reclaim seat 0'; end if;

  select seat_index into my_seat
    from public.room_members
   where room_id = _room_id and user_id = me;

  select user_id into cur_occupant
    from public.room_members
   where room_id = _room_id and seat_index = 0 and user_id <> me
   limit 1;

  -- Free both slots first to avoid transient conflicts.
  update public.room_members set seat_index = null
   where room_id = _room_id and user_id in (me, coalesce(cur_occupant, me));

  -- Place host on seat 0.
  insert into public.room_members (room_id, user_id, seat_index)
    values (_room_id, me, 0)
    on conflict (room_id, user_id) do update set seat_index = 0;

  -- If someone was on seat 0, put them on host's old seat (or leave as viewer).
  if cur_occupant is not null then
    if my_seat is not null and my_seat <> 0 then
      insert into public.room_members (room_id, user_id, seat_index)
        values (_room_id, cur_occupant, my_seat)
        on conflict (room_id, user_id) do update set seat_index = my_seat;
    else
      insert into public.room_members (room_id, user_id, seat_index)
        values (_room_id, cur_occupant, null)
        on conflict (room_id, user_id) do update set seat_index = null;
    end if;
  end if;
end $$;

grant execute on function public.host_reclaim_video_seat(uuid) to authenticated;
