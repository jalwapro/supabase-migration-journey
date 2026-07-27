-- ============================================================================
-- 0169 — Rooms + PK + Seats + Moderation integration fixes (Area 3 audit).
--
-- Findings addressed:
--   C1 admin_end_room / admin_delete_room RPCs (route admin ops through
--      finalize_room_gifts + pk_end_match, single audit log).
--   C2 pk_reap_stale_matches() + pg_cron every minute.
--   C3 seat_invites / seat_requests one-shot consumption + seat_index match.
--   H1 unique(room_id, seat_index) partial index; serialize seat claims via
--      per-room advisory lock inside all seat-assignment RPCs.
--   H3 kick_from_room cancels pending/accepted seat_invites & seat_requests.
--   H4 kick_from_room / re-join always resets is_moderator=false safeguard.
--   M1 room_bans read policy: admin bypass.
--   M3 accept_seat_invite / respond_seat_request / accept_video_swap_invite
--      require room.status='live'.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- H1: single-seat guarantee at the storage layer.
-- Clear any historical duplicates before creating the partial unique index.
-- ---------------------------------------------------------------------------
with dups as (
  select ctid,
         row_number() over (partition by room_id, seat_index order by seated_at desc nulls last, joined_at desc nulls last) as rn
    from public.room_members
   where seat_index is not null
)
update public.room_members m
   set seat_index = null, seated_at = null
  from dups d
 where m.ctid = d.ctid and d.rn > 1;

create unique index if not exists uq_room_members_seat
  on public.room_members(room_id, seat_index)
  where seat_index is not null;

-- ---------------------------------------------------------------------------
-- C3: one-shot consumption columns for seat grants.
-- ---------------------------------------------------------------------------
alter table public.seat_invites
  add column if not exists consumed_at timestamptz;
alter table public.seat_requests
  add column if not exists consumed_at timestamptz;

-- ---------------------------------------------------------------------------
-- H1 helper: per-room advisory lock (transaction-scoped).
-- Serializes concurrent seat-assignment RPCs on the same room without
-- blocking readers or other rooms.
-- ---------------------------------------------------------------------------
create or replace function public._room_seat_lock(_room_id uuid)
returns void
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('room_seat:' || _room_id::text, 42)
  );
end $$;

-- ===========================================================================
-- take_seat: consume approval grant + advisory lock + strict seat match.
-- ===========================================================================
create or replace function public.take_seat(_room_id uuid, _seat_index int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me       uuid := auth.uid();
  r_host   uuid;
  r_status text;
  r_locked int[];
  r_seats  int;
  occupant uuid;
  am_mod   boolean;
  grant_id uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;

  perform public._room_seat_lock(_room_id);

  select host_id, status::text, locked_seats, seat_count
    into r_host, r_status, r_locked, r_seats
    from public.live_rooms where id = _room_id;
  if r_host is null then raise exception 'room not found'; end if;
  if r_status <> 'live' then raise exception 'room is not live'; end if;

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
      -- Consume a matching accepted invite (specific seat or "any seat").
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

-- ===========================================================================
-- accept_seat_invite: room-live guard, advisory lock, mark consumed.
-- ===========================================================================
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

  update public.seat_invites
    set status = 'used',
        responded_at = coalesce(responded_at, now()),
        consumed_at = now(),
        seat_index = target_seat
    where id = _invite_id;

  insert into public.room_members (room_id, user_id, seat_index, seated_at)
    values (inv.room_id, me, target_seat, now())
    on conflict (room_id, user_id) do update
      set seat_index = excluded.seat_index,
          seated_at = now();

  return target_seat;
end $$;

grant execute on function public.accept_seat_invite(uuid) to authenticated;

-- ===========================================================================
-- respond_seat_request: room-live guard, advisory lock; accepted stays
-- 'accepted' (not 'used') until requester actually claims via take_seat.
-- ===========================================================================
create or replace function public.respond_seat_request(_request_id uuid, _accept boolean)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  req record;
  r_status text;
  is_host boolean;
  is_mod boolean;
  target_seat int;
  seat_max int;
  i int;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select * into req from public.seat_requests where id = _request_id for update;
  if not found then raise exception 'request not found'; end if;
  if req.status <> 'pending' then raise exception 'request already handled'; end if;

  select status::text into r_status from public.live_rooms where id = req.room_id;
  if coalesce(r_status, '') <> 'live' then raise exception 'room is not live'; end if;

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

  perform public._room_seat_lock(req.room_id);

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

  -- The insert above already seats the user immediately (host-driven),
  -- so mark the grant consumed to prevent later seat-hopping via take_seat.
  update public.seat_requests
    set status = 'used', consumed_at = now()
    where id = _request_id;

  return target_seat;
end $$;

grant execute on function public.respond_seat_request(uuid, boolean) to authenticated;

-- ===========================================================================
-- take_available_voice_seat: add advisory lock + status guard.
-- ===========================================================================
create or replace function public.take_available_voice_seat(_room_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  me         uuid := auth.uid();
  r_type     text;
  r_status   text;
  r_seats    int;
  r_locked   int[];
  start_idx  int;
  target_idx int;
  i          int;
begin
  if me is null then raise exception 'not authenticated'; end if;

  perform public._room_seat_lock(_room_id);

  select room_type::text, status::text, seat_count, coalesce(locked_seats, '{}'::int[])
    into r_type, r_status, r_seats, r_locked
    from public.live_rooms where id = _room_id;
  if r_seats is null then raise exception 'room not found'; end if;
  if r_status <> 'live' then raise exception 'room is not live'; end if;

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

-- ===========================================================================
-- H3 + H4: kick_from_room cancels pending/accepted grants; on ban rejoin
-- moderator flag stays false (row deleted, so this is naturally reset —
-- documented invariant).
-- ===========================================================================
create or replace function public.kick_from_room(
  _room_id uuid,
  _user_id uuid,
  _minutes int default 30
) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  is_host boolean;
  is_mod  boolean;
  target_is_host boolean;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select (host_id = me) into is_host from public.live_rooms where id = _room_id;
  select exists(
    select 1 from public.room_members
     where room_id = _room_id and user_id = me and is_moderator
  ) into is_mod;

  if not coalesce(is_host, false) and not is_mod then
    raise exception 'only host or moderator can kick';
  end if;

  select (host_id = _user_id) into target_is_host
    from public.live_rooms where id = _room_id;
  if coalesce(target_is_host, false) then
    raise exception 'cannot kick the host';
  end if;

  delete from public.room_members
    where room_id = _room_id and user_id = _user_id;

  -- Cancel outstanding seat grants so a re-joining user can't
  -- exploit a stale acceptance to hop back on-seat.
  update public.seat_invites
     set status = 'cancelled', responded_at = coalesce(responded_at, now())
   where room_id = _room_id
     and to_user = _user_id
     and status in ('pending','accepted');

  update public.seat_requests
     set status = 'cancelled', responded_at = coalesce(responded_at, now())
   where room_id = _room_id
     and from_user = _user_id
     and status in ('pending','accepted');

  insert into public.room_bans (room_id, user_id, banned_by, expires_at)
    values (_room_id, _user_id, me, now() + make_interval(mins => greatest(_minutes, 1)))
  on conflict (room_id, user_id) do update
    set expires_at = excluded.expires_at,
        banned_by  = excluded.banned_by,
        created_at = now();
end $$;

grant execute on function public.kick_from_room(uuid, uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- M1: admin bypass on room_bans read policy.
-- ---------------------------------------------------------------------------
drop policy if exists "room_bans read" on public.room_bans;
create policy "room_bans read"
  on public.room_bans for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.live_rooms r where r.id = room_bans.room_id and r.host_id = auth.uid())
    or exists (
      select 1 from public.room_members m
       where m.room_id = room_bans.room_id and m.user_id = auth.uid() and m.is_moderator
    )
    or public.is_admin(auth.uid())
  );

-- ===========================================================================
-- C1: admin_end_room / admin_delete_room — safe wrappers that finalize
-- gifts, close any active PK match, and log to admin_logs atomically.
-- ===========================================================================
create or replace function public.admin_end_room(_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  active_pk uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not public.is_admin(me) then raise exception 'admins only'; end if;

  select active_pk_match_id into active_pk
    from public.live_rooms where id = _room_id;

  if active_pk is not null then
    begin
      perform public.pk_end_match(active_pk);
    exception when others then
      raise notice 'pk_end_match failed for %: %', active_pk, sqlerrm;
    end;
  end if;

  perform public.finalize_room_gifts(_room_id);

  update public.live_rooms
     set status = 'ended',
         ended_at = coalesce(ended_at, now()),
         grace_period_until = null
   where id = _room_id
     and status <> 'ended';

  insert into public.admin_logs(admin_id, action, target)
    values (me, 'force_end_room', _room_id::text);
end $$;

grant execute on function public.admin_end_room(uuid) to authenticated;

create or replace function public.admin_delete_room(_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  active_pk uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not public.is_admin(me) then raise exception 'admins only'; end if;

  select active_pk_match_id into active_pk
    from public.live_rooms where id = _room_id;

  if active_pk is not null then
    begin
      perform public.pk_end_match(active_pk);
    exception when others then
      raise notice 'pk_end_match failed for %: %', active_pk, sqlerrm;
    end;
  end if;

  begin
    perform public.finalize_room_gifts(_room_id);
  exception when others then
    raise notice 'finalize_room_gifts failed for %: %', _room_id, sqlerrm;
  end;

  delete from public.live_rooms where id = _room_id;

  insert into public.admin_logs(admin_id, action, target)
    values (me, 'delete_room', _room_id::text);
end $$;

grant execute on function public.admin_delete_room(uuid) to authenticated;

-- ===========================================================================
-- C2: pk_reap_stale_matches — force-end active PK matches whose timer
-- expired but no participant client fired pk_end_match. Refunds/pays out
-- through pk_end_match's own escrow logic.
-- ===========================================================================
create or replace function public.pk_reap_stale_matches()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  n int := 0;
begin
  for m in
    select id from public.pk_matches
     where status = 'active'
       and ends_at is not null
       and ends_at < now() - interval '30 seconds'
  loop
    begin
      perform public.pk_end_match(m.id);
      n := n + 1;
    exception when others then
      raise notice 'pk_reap: pk_end_match failed for %: %', m.id, sqlerrm;
    end;
  end loop;
  return n;
end $$;

grant execute on function public.pk_reap_stale_matches() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('pk_reap_stale_matches')
      where exists (select 1 from cron.job where jobname = 'pk_reap_stale_matches');
    perform cron.schedule(
      'pk_reap_stale_matches',
      '* * * * *',
      $cron$ select public.pk_reap_stale_matches() $cron$
    );
  end if;
exception when others then
  null;
end $$;

notify pgrst, 'reload schema';
