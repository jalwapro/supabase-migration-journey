-- ============================================================================
-- Phase: Seat invites (host/mod → viewer) + seat locks
-- ============================================================================

-- ---------- live_rooms: locked_seats array ---------------------------------
alter table public.live_rooms
  add column if not exists locked_seats int[] not null default '{}'::int[];

-- ---------- seat_invites --------------------------------------------------
do $$ begin
  create type public.seat_invite_status as enum ('pending','accepted','declined','cancelled','expired');
exception when duplicate_object then null; end $$;

create table if not exists public.seat_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  seat_index int,      -- null = any free seat
  status public.seat_invite_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists idx_seat_invites_room on public.seat_invites(room_id, status);
create index if not exists idx_seat_invites_to on public.seat_invites(to_user, status, created_at desc);

grant select, insert, update on public.seat_invites to authenticated;
grant all on public.seat_invites to service_role;

alter table public.seat_invites enable row level security;

drop policy if exists "seat invites: sender/recipient/host read" on public.seat_invites;
create policy "seat invites: sender/recipient/host read"
  on public.seat_invites for select
  to authenticated
  using (
    auth.uid() = from_user
    or auth.uid() = to_user
    or exists (
      select 1 from public.live_rooms r
      where r.id = seat_invites.room_id and r.host_id = auth.uid()
    )
    or public.is_admin(auth.uid())
  );

-- Only host or moderator of the room may invite
drop policy if exists "seat invites: host/mod insert" on public.seat_invites;
create policy "seat invites: host/mod insert"
  on public.seat_invites for insert
  to authenticated
  with check (
    auth.uid() = from_user
    and (
      exists (
        select 1 from public.live_rooms r
        where r.id = seat_invites.room_id and r.host_id = auth.uid()
      )
      or exists (
        select 1 from public.room_members m
        where m.room_id = seat_invites.room_id
          and m.user_id = auth.uid()
          and m.is_moderator = true
      )
      or public.is_admin(auth.uid())
    )
  );

-- Recipient may update (accept/decline). Sender/host may cancel.
drop policy if exists "seat invites: respond or cancel" on public.seat_invites;
create policy "seat invites: respond or cancel"
  on public.seat_invites for update
  to authenticated
  using (
    auth.uid() = to_user
    or auth.uid() = from_user
    or exists (
      select 1 from public.live_rooms r
      where r.id = seat_invites.room_id and r.host_id = auth.uid()
    )
  )
  with check (
    auth.uid() = to_user
    or auth.uid() = from_user
    or exists (
      select 1 from public.live_rooms r
      where r.id = seat_invites.room_id and r.host_id = auth.uid()
    )
  );

-- ---------- Realtime -------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='seat_invites'
  ) then
    execute 'alter publication supabase_realtime add table public.seat_invites';
  end if;
  execute 'alter table public.seat_invites replica identity full';
end $$;

-- ---------- take_seat RPC: enforce host-only seat 0 + lock check -----------
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
begin
  if me is null then raise exception 'not authenticated'; end if;

  select host_id, locked_seats into r_host, r_locked
    from public.live_rooms where id = _room_id;
  if r_host is null then raise exception 'room not found'; end if;

  -- Seat 0 = host only
  if _seat_index = 0 and me <> r_host then
    raise exception 'Seat 1 is reserved for the host';
  end if;

  -- Locked seat: only host / moderator can occupy
  if _seat_index = any(coalesce(r_locked, '{}'::int[])) then
    if me <> r_host and not exists (
      select 1 from public.room_members
      where room_id = _room_id and user_id = me and is_moderator = true
    ) then
      raise exception 'Seat is locked';
    end if;
  end if;

  -- Host moving off seat 0 → free seat 0 (row stays with seat_index=null)
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

-- ---------- toggle_seat_lock RPC (host or moderator) -----------------------
create or replace function public.toggle_seat_lock(_room_id uuid, _seat_index int, _locked boolean)
returns int[]
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  r_host uuid;
  cur int[];
begin
  if me is null then raise exception 'not authenticated'; end if;

  select host_id, locked_seats into r_host, cur
    from public.live_rooms where id = _room_id;
  if r_host is null then raise exception 'room not found'; end if;

  if me <> r_host and not exists (
    select 1 from public.room_members
    where room_id = _room_id and user_id = me and is_moderator = true
  ) then
    raise exception 'only host or moderator can lock seats';
  end if;

  cur := coalesce(cur, '{}'::int[]);
  if _locked then
    if not (_seat_index = any(cur)) then
      cur := array_append(cur, _seat_index);
    end if;
  else
    cur := array_remove(cur, _seat_index);
  end if;

  update public.live_rooms set locked_seats = cur where id = _room_id;
  return cur;
end $$;

grant execute on function public.toggle_seat_lock(uuid, int, boolean) to authenticated;

-- ---------- accept_seat_invite RPC ---------------------------------------
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

  -- Pick seat: explicit or first free (skip seat 0 = host)
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

  insert into public.room_members (room_id, user_id, seat_index)
    values (inv.room_id, me, target_seat)
    on conflict (room_id, user_id) do update
      set seat_index = excluded.seat_index;

  update public.seat_invites
    set status = 'accepted', responded_at = now()
    where id = _invite_id;

  return target_seat;
end $$;

grant execute on function public.accept_seat_invite(uuid) to authenticated;
