-- 0175: Fix RLS-style error "seat requires host or moderator invite" (SQLSTATE 42501)
-- raised by trg_guard_self_seat_claim when an invitee accepts a seat invite.
--
-- Regression: 0169's accept_seat_invite sets seat_invites.status = 'used' in a
-- single UPDATE BEFORE inserting into room_members. The self-seat guard
-- trigger requires an 'accepted' invite row for the acting user; with the
-- status jumping straight to 'used' the trigger cannot see one and raises
-- 42501, which surfaces on the client as a "new row violates row-level
-- security policy"-style error when picking a seat.
--
-- Fix: mark the invite 'accepted' first, insert the room_members row (guard
-- trigger sees the accepted invite), then mark it 'used' + consumed. Same
-- SECURITY DEFINER + advisory lock semantics as 0169.

create or replace function public.accept_seat_invite(_invite_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  inv record;
  r_status text;
  target_seat int;
  seat_max int;
  i int;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select * into inv from public.seat_invites where id = _invite_id for update;
  if not found then raise exception 'invite not found'; end if;
  if inv.to_user <> me then raise exception 'not your invite'; end if;
  if inv.status <> 'pending' then raise exception 'invite already responded'; end if;

  select status::text into r_status from public.live_rooms where id = inv.room_id;
  if coalesce(r_status, '') <> 'live' then raise exception 'room is not live'; end if;

  perform public._room_seat_lock(inv.room_id);

  if inv.seat_index is not null then
    target_seat := inv.seat_index;
    if exists (
      select 1 from public.room_members
       where room_id = inv.room_id and seat_index = target_seat
    ) then
      raise exception 'seat already taken';
    end if;
  else
    select seat_count into seat_max from public.live_rooms where id = inv.room_id;
    target_seat := null;
    for i in 1 .. coalesce(seat_max, 8) - 1 loop
      if not exists (
        select 1 from public.room_members
        where room_id = inv.room_id and seat_index = i
      ) then
        target_seat := i;
        exit;
      end if;
    end loop;
    if target_seat is null then raise exception 'no free seat'; end if;
  end if;

  -- Step 1: mark accepted BEFORE the room_members write so the
  -- self-seat guard trigger (trg_guard_self_seat_claim) sees it.
  update public.seat_invites
     set status = 'accepted',
         responded_at = now(),
         seat_index = target_seat
   where id = _invite_id;

  -- Step 2: seat the invitee.
  insert into public.room_members (room_id, user_id, seat_index, seated_at)
    values (inv.room_id, me, target_seat, now())
    on conflict (room_id, user_id) do update
      set seat_index = excluded.seat_index,
          seated_at = now();

  -- Step 3: consume the grant so it can't be replayed.
  update public.seat_invites
     set status = 'used',
         consumed_at = now()
   where id = _invite_id;

  return target_seat;
end $$;

grant execute on function public.accept_seat_invite(uuid) to authenticated;
