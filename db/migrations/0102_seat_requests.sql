-- Seat requests: user apeel karta hai kisi seat ki, host/mod accept ya reject karay.
create table if not exists public.seat_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  seat_index int,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  responded_by uuid
);

create index if not exists idx_seat_requests_room on public.seat_requests(room_id, status, created_at desc);
create index if not exists idx_seat_requests_from on public.seat_requests(from_user, status, created_at desc);
-- Prevent duplicate pending requests
create unique index if not exists uq_seat_requests_pending
  on public.seat_requests(room_id, from_user) where status = 'pending';

grant select, insert, update on public.seat_requests to authenticated;
grant all on public.seat_requests to service_role;

alter table public.seat_requests enable row level security;

drop policy if exists "seat requests: participants read" on public.seat_requests;
create policy "seat requests: participants read"
  on public.seat_requests for select
  to authenticated
  using (
    from_user = auth.uid()
    or exists (
      select 1 from public.live_rooms r
      where r.id = seat_requests.room_id and r.host_id = auth.uid()
    )
    or exists (
      select 1 from public.room_members m
      where m.room_id = seat_requests.room_id
        and m.user_id = auth.uid()
        and coalesce(m.is_moderator, false) = true
    )
  );

drop policy if exists "seat requests: user creates own" on public.seat_requests;
create policy "seat requests: user creates own"
  on public.seat_requests for insert
  to authenticated
  with check (from_user = auth.uid());

drop policy if exists "seat requests: user cancels; host/mod responds" on public.seat_requests;
create policy "seat requests: user cancels; host/mod responds"
  on public.seat_requests for update
  to authenticated
  using (
    from_user = auth.uid()
    or exists (
      select 1 from public.live_rooms r
      where r.id = seat_requests.room_id and r.host_id = auth.uid()
    )
    or exists (
      select 1 from public.room_members m
      where m.room_id = seat_requests.room_id
        and m.user_id = auth.uid()
        and coalesce(m.is_moderator, false) = true
    )
  );

-- Realtime
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='seat_requests'
  ) then
    execute 'alter publication supabase_realtime add table public.seat_requests';
  end if;
  execute 'alter table public.seat_requests replica identity full';
end $$;

-- ---------- request_seat RPC -------------------------------------------
create or replace function public.request_seat(_room_id uuid, _seat_index int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  host uuid;
  seat_taken boolean;
  locked int[];
  req_id uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select host_id, locked_seats into host, locked from public.live_rooms where id = _room_id;
  if host is null then raise exception 'room not found'; end if;
  if host = me then raise exception 'you are the host'; end if;

  if _seat_index is not null then
    if _seat_index = 0 then raise exception 'seat 1 is for host'; end if;
    if locked is not null and _seat_index = any(locked) then raise exception 'seat is locked'; end if;
    select exists(
      select 1 from public.room_members
      where room_id = _room_id and seat_index = _seat_index
    ) into seat_taken;
    if seat_taken then raise exception 'seat already taken'; end if;
  end if;

  -- Reuse existing pending row if present.
  select id into req_id from public.seat_requests
    where room_id = _room_id and from_user = me and status = 'pending';
  if req_id is not null then
    update public.seat_requests set seat_index = _seat_index, created_at = now()
      where id = req_id;
    return req_id;
  end if;

  insert into public.seat_requests (room_id, from_user, seat_index)
    values (_room_id, me, _seat_index)
    returning id into req_id;
  return req_id;
end $$;

grant execute on function public.request_seat(uuid, int) to authenticated;

-- ---------- respond_seat_request RPC -----------------------------------
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

  -- Pick seat: requested or first free (skip seat 0 = host).
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

  -- Mark accepted FIRST so the seat-guard trigger sees the accepted invite equivalent.
  update public.seat_requests
    set status = 'accepted', responded_at = now(), responded_by = me, seat_index = target_seat
    where id = _request_id;

  -- Insert as SECURITY DEFINER (auth.uid() is host/mod, not requester),
  -- so the self-seat-claim guard trigger is bypassed (NEW.user_id <> me).
  insert into public.room_members (room_id, user_id, seat_index)
    values (req.room_id, req.from_user, target_seat)
    on conflict (room_id, user_id) do update
      set seat_index = excluded.seat_index;

  return target_seat;
end $$;

grant execute on function public.respond_seat_request(uuid, boolean) to authenticated;
