-- Server-side enforcement: viewers can NOT take a seat directly.
-- Only host, moderators, host-approved seat_requests, and accepted
-- seat_invites may occupy a seat. Everyone else must go through
-- request_seat (0102) → respond_seat_request or accept_seat_invite.

create or replace function public.take_seat(_room_id uuid, _seat_index int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  r_host uuid;
  r_locked int[];
  am_mod boolean;
  has_accepted_invite boolean;
  has_accepted_request boolean;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select host_id, locked_seats into r_host, r_locked
    from public.live_rooms where id = _room_id;
  if r_host is null then raise exception 'room not found'; end if;

  -- Seat 0 = host only
  if _seat_index = 0 and me <> r_host then
    raise exception 'Seat 1 is reserved for the host';
  end if;

  -- Locked seat: only host / moderator may occupy
  if _seat_index = any(coalesce(r_locked, '{}'::int[])) then
    if me <> r_host and not exists (
      select 1 from public.room_members
      where room_id = _room_id and user_id = me and is_moderator = true
    ) then
      raise exception 'Seat is locked';
    end if;
  end if;

  -- Approval gate: viewers must have an accepted invite or approved
  -- seat request. Host and moderators bypass this.
  if me <> r_host then
    select coalesce(is_moderator, false) into am_mod
      from public.room_members
      where room_id = _room_id and user_id = me;

    if not coalesce(am_mod, false) then
      select exists (
        select 1 from public.seat_invites
        where room_id = _room_id and to_user = me and status = 'accepted'
      ) into has_accepted_invite;

      select exists (
        select 1 from public.seat_requests
        where room_id = _room_id and from_user = me and status = 'accepted'
      ) into has_accepted_request;

      if not (has_accepted_invite or has_accepted_request) then
        raise exception 'Host approval required — raise hand first';
      end if;
    end if;
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
