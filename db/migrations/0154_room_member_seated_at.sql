-- Track the current seat session separately from room join time so seat gift
-- points reset every time a user leaves a seat and sits again.

alter table public.room_members
  add column if not exists seated_at timestamptz;

update public.room_members
   set seated_at = joined_at
 where seat_index is not null
   and seated_at is null;

create index if not exists idx_room_members_room_seated_at
  on public.room_members(room_id, seated_at desc)
  where seat_index is not null;

create index if not exists idx_gift_sends_room_receiver_created
  on public.gift_sends(room_id, receiver_id, created_at desc);

create or replace function public.sync_room_member_seated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.seat_index is not null and new.seated_at is null then
      new.seated_at := now();
    elsif new.seat_index is null then
      new.seated_at := null;
    end if;
    return new;
  end if;

  if new.seat_index is null then
    new.seated_at := null;
  elsif old.seat_index is null or old.seat_index is distinct from new.seat_index then
    new.seated_at := now();
  elsif new.seated_at is null then
    new.seated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_room_members_sync_seated_at on public.room_members;
create trigger trg_room_members_sync_seated_at
before insert or update of seat_index, seated_at
on public.room_members
for each row
execute function public.sync_room_member_seated_at();

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
  am_mod boolean;
  has_accepted_invite boolean;
  has_accepted_request boolean;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select host_id, locked_seats, seat_count
    into r_host, r_locked, r_seats
    from public.live_rooms where id = _room_id;
  if r_host is null then raise exception 'room not found'; end if;

  if _seat_index < 0 or _seat_index >= coalesce(r_seats, 8) then
    raise exception 'invalid seat index';
  end if;

  if _seat_index = 0 and me <> r_host then
    raise exception 'Seat 1 is reserved for the host';
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
    raise exception 'Seat is taken';
  end if;

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

  if me = r_host and _seat_index <> 0 then
    update public.room_members
       set seat_index = null, seated_at = null
     where room_id = _room_id and seat_index = 0 and user_id = me;
  end if;

  insert into public.room_members (room_id, user_id, seat_index, seated_at)
    values (_room_id, me, _seat_index, now())
    on conflict (room_id, user_id) do update
      set seat_index = excluded.seat_index,
          seated_at = now();
end $$;

grant execute on function public.take_seat(uuid, int) to authenticated;

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

  start_idx := case when r_type = 'video' then 2 else 1 end;

  select seat_index into target_idx
    from public.room_members
   where room_id = _room_id and user_id = me and seat_index is not null;
  if target_idx is not null then
    return target_idx;
  end if;

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

  insert into public.room_members (room_id, user_id, seat_index, seated_at)
    values (_room_id, me, target_idx, now())
    on conflict (room_id, user_id) do update
      set seat_index = excluded.seat_index,
          seated_at = now();

  return target_idx;
end $$;

grant execute on function public.take_available_voice_seat(uuid) to authenticated;

create or replace function public.accept_seat_invite(_invite_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  inv record;
  target_seat int;
  seat_max int;
  i int;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select * into inv from public.seat_invites where id = _invite_id;
  if not found then raise exception 'invite not found'; end if;
  if inv.to_user <> me then raise exception 'not your invite'; end if;
  if inv.status <> 'pending' then raise exception 'invite already responded'; end if;

  if inv.seat_index is not null then
    target_seat := inv.seat_index;
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

  update public.seat_invites
    set status = 'accepted', responded_at = now()
    where id = _invite_id;

  insert into public.room_members (room_id, user_id, seat_index, seated_at)
    values (inv.room_id, me, target_seat, now())
    on conflict (room_id, user_id) do update
      set seat_index = excluded.seat_index,
          seated_at = now();

  return target_seat;
end $$;

grant execute on function public.accept_seat_invite(uuid) to authenticated;

create or replace function public.respond_seat_request(_request_id uuid, _accept boolean)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  req record;
  is_host boolean;
  is_mod boolean;
  target_seat int;
  seat_max int;
  i int;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select * into req from public.seat_requests where id = _request_id;
  if not found then raise exception 'request not found'; end if;
  if req.status <> 'pending' then raise exception 'request already handled'; end if;

  select (r.host_id = me) into is_host from public.live_rooms r where r.id = req.room_id;
  select coalesce(m.is_moderator, false) into is_mod
    from public.room_members m
    where m.room_id = req.room_id and m.user_id = me;
  if not (coalesce(is_host, false) or coalesce(is_mod, false)) then
    raise exception 'only host or moderator can respond';
  end if;

  if not _accept then
    update public.seat_requests
      set status = 'rejected', responded_at = now(), responded_by = me
      where id = _request_id;
    return -1;
  end if;

  if req.seat_index is not null then
    target_seat := req.seat_index;
    if exists (
      select 1 from public.room_members
      where room_id = req.room_id and seat_index = target_seat
    ) then
      raise exception 'seat already taken';
    end if;
  else
    select seat_count into seat_max from public.live_rooms where id = req.room_id;
    target_seat := null;
    for i in 1 .. coalesce(seat_max, 8) - 1 loop
      if not exists (
        select 1 from public.room_members
        where room_id = req.room_id and seat_index = i
      ) then
        target_seat := i;
        exit;
      end if;
    end loop;
    if target_seat is null then raise exception 'no free seat'; end if;
  end if;

  update public.seat_requests
    set status = 'accepted', responded_at = now(), responded_by = me, seat_index = target_seat
    where id = _request_id;

  insert into public.room_members (room_id, user_id, seat_index, seated_at)
    values (req.room_id, req.from_user, target_seat, now())
    on conflict (room_id, user_id) do update
      set seat_index = excluded.seat_index,
          seated_at = now();

  return target_seat;
end $$;

grant execute on function public.respond_seat_request(uuid, boolean) to authenticated;

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

  select seat_index into my_seat
    from public.room_members
   where room_id = inv.room_id and user_id = me;
  if my_seat is null or my_seat = 0 then
    raise exception 'you must be on an audio seat to accept';
  end if;

  update public.seat_invites
    set status = 'accepted', responded_at = now()
   where id = _invite_id;

  update public.room_members
     set seat_index = null, seated_at = null
   where room_id = inv.room_id and user_id in (me, r_host);

  insert into public.room_members (room_id, user_id, seat_index, seated_at)
    values (inv.room_id, me, 0, now())
    on conflict (room_id, user_id) do update
      set seat_index = 0,
          seated_at = now();

  insert into public.room_members (room_id, user_id, seat_index, seated_at)
    values (inv.room_id, r_host, my_seat, now())
    on conflict (room_id, user_id) do update
      set seat_index = my_seat,
          seated_at = now();

  return my_seat;
end $$;

grant execute on function public.accept_video_swap_invite(uuid) to authenticated;

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

  update public.room_members
     set seat_index = null, seated_at = null
   where room_id = _room_id and user_id in (me, coalesce(cur_occupant, me));

  insert into public.room_members (room_id, user_id, seat_index, seated_at)
    values (_room_id, me, 0, now())
    on conflict (room_id, user_id) do update
      set seat_index = 0,
          seated_at = now();

  if cur_occupant is not null then
    if my_seat is not null and my_seat <> 0 then
      insert into public.room_members (room_id, user_id, seat_index, seated_at)
        values (_room_id, cur_occupant, my_seat, now())
        on conflict (room_id, user_id) do update
          set seat_index = my_seat,
              seated_at = now();
    else
      insert into public.room_members (room_id, user_id, seat_index, seated_at)
        values (_room_id, cur_occupant, null, null)
        on conflict (room_id, user_id) do update
          set seat_index = null,
              seated_at = null;
    end if;
  end if;
end $$;

grant execute on function public.host_reclaim_video_seat(uuid) to authenticated;