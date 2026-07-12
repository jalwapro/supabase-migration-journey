-- ============================================================================
-- Video room: host invites an audio-seat guest to swap onto the video (seat 0).
-- Reuses public.seat_invites (seat_index = 0 signals a "video swap" invite).
-- On accept, atomically swaps host (seat 0) ↔ invitee (their current audio seat).
-- ============================================================================

create or replace function public.accept_video_swap_invite(_invite_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  inv record;
  r_host uuid;
  my_seat int;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select * into inv from public.seat_invites where id = _invite_id;
  if not found then raise exception 'invite not found'; end if;
  if inv.to_user <> me then raise exception 'not your invite'; end if;
  if inv.status <> 'pending' then raise exception 'invite already responded'; end if;
  if coalesce(inv.seat_index, -1) <> 0 then
    raise exception 'not a video swap invite';
  end if;

  select host_id into r_host from public.live_rooms where id = inv.room_id;
  if r_host is null then raise exception 'room not found'; end if;
  if inv.from_user <> r_host then raise exception 'only host can send video swap'; end if;

  -- Find my current seat (must be on some audio seat > 0)
  select seat_index into my_seat
    from public.room_members
   where room_id = inv.room_id and user_id = me;
  if my_seat is null or my_seat = 0 then
    raise exception 'you must be on an audio seat to accept';
  end if;

  -- Atomic swap: temp free both, then place.
  update public.room_members set seat_index = null
   where room_id = inv.room_id and user_id in (me, r_host);

  insert into public.room_members (room_id, user_id, seat_index)
    values (inv.room_id, me, 0)
    on conflict (room_id, user_id) do update set seat_index = 0;

  insert into public.room_members (room_id, user_id, seat_index)
    values (inv.room_id, r_host, my_seat)
    on conflict (room_id, user_id) do update set seat_index = my_seat;

  update public.seat_invites
    set status = 'accepted', responded_at = now()
   where id = _invite_id;

  return my_seat;
end $$;

grant execute on function public.accept_video_swap_invite(uuid) to authenticated;
