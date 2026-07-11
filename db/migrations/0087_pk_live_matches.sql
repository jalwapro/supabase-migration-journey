-- =============================================================
-- Live PK Match (TikTok-style, invite-based, 3/5/10 min)
-- - pk_invites: host A challenges host B (pending/accepted/declined/expired)
-- - pk_matches: active/ended live PK between two hosts + rooms
-- - pk_match_score(match_id): live score from gift_sends
-- - pk_send_invite / pk_respond_invite / pk_end_match RPCs
-- =============================================================

-- 1) pk_invites --------------------------------------------------
create table if not exists public.pk_invites (
  id            uuid primary key default gen_random_uuid(),
  from_host     uuid not null references auth.users(id) on delete cascade,
  to_host       uuid not null references auth.users(id) on delete cascade,
  from_room     uuid not null references public.live_rooms(id) on delete cascade,
  to_room       uuid          references public.live_rooms(id) on delete set null,
  duration_sec  int  not null default 180 check (duration_sec in (180, 300, 600)),
  status        text not null default 'pending' check (status in ('pending','accepted','declined','expired','cancelled')),
  match_id      uuid,
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  expires_at    timestamptz not null default (now() + interval '45 seconds')
);

create index if not exists idx_pk_invites_to   on public.pk_invites(to_host,   status, created_at desc);
create index if not exists idx_pk_invites_from on public.pk_invites(from_host, status, created_at desc);

grant select, insert, update on public.pk_invites to authenticated;
grant all on public.pk_invites to service_role;

alter table public.pk_invites enable row level security;

drop policy if exists "pk invites: participants read" on public.pk_invites;
create policy "pk invites: participants read"
  on public.pk_invites for select to authenticated
  using (auth.uid() = from_host or auth.uid() = to_host);

drop policy if exists "pk invites: sender writes via rpc" on public.pk_invites;
-- (No direct insert/update policy — force everything through SECURITY DEFINER RPCs.)

-- 2) pk_matches --------------------------------------------------
create table if not exists public.pk_matches (
  id            uuid primary key default gen_random_uuid(),
  host_a        uuid not null references auth.users(id) on delete cascade,
  host_b        uuid not null references auth.users(id) on delete cascade,
  room_a        uuid not null references public.live_rooms(id) on delete cascade,
  room_b        uuid not null references public.live_rooms(id) on delete cascade,
  duration_sec  int  not null,
  started_at    timestamptz not null default now(),
  ends_at       timestamptz not null,
  ended_at      timestamptz,
  score_a       bigint not null default 0,
  score_b       bigint not null default 0,
  winner_id     uuid,
  status        text not null default 'active' check (status in ('active','ended','cancelled')),
  created_at    timestamptz not null default now()
);

create index if not exists idx_pk_matches_room_a on public.pk_matches(room_a, status);
create index if not exists idx_pk_matches_room_b on public.pk_matches(room_b, status);
create index if not exists idx_pk_matches_active on public.pk_matches(status, ends_at);

grant select on public.pk_matches to authenticated;
grant all    on public.pk_matches to service_role;

alter table public.pk_matches enable row level security;

drop policy if exists "pk matches: public read" on public.pk_matches;
create policy "pk matches: public read"
  on public.pk_matches for select to authenticated using (true);

-- 3) Add active_pk_match_id to live_rooms for quick lookup
alter table public.live_rooms
  add column if not exists active_pk_match_id uuid references public.pk_matches(id) on delete set null;

-- 4) Live score (computed from gift_sends inside the match window) -------
create or replace function public.pk_match_score(_match_id uuid)
returns table(score_a bigint, score_b bigint)
language sql
stable
security definer
set search_path = public
as $$
  with m as (select * from public.pk_matches where id = _match_id)
  select
    coalesce(sum(case when gs.receiver_id = m.host_a then gs.coins_spent end), 0)::bigint as score_a,
    coalesce(sum(case when gs.receiver_id = m.host_b then gs.coins_spent end), 0)::bigint as score_b
  from m
  left join public.gift_sends gs
    on gs.receiver_id in (m.host_a, m.host_b)
   and gs.created_at >= m.started_at
   and gs.created_at <= coalesce(m.ended_at, m.ends_at);
$$;

grant execute on function public.pk_match_score(uuid) to authenticated;

-- 5) Send invite -------------------------------------------------
create or replace function public.pk_send_invite(_to_host uuid, _duration_sec int)
returns public.pk_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  my_room public.live_rooms;
  their_room public.live_rooms;
  inv public.pk_invites;
begin
  if me is null then raise exception 'auth required'; end if;
  if me = _to_host then raise exception 'cannot challenge yourself'; end if;
  if _duration_sec not in (180, 300, 600) then raise exception 'invalid duration'; end if;

  select * into my_room from public.live_rooms
    where host_id = me and status = 'live'
    order by created_at desc limit 1;
  if my_room.id is null then raise exception 'you must be live to challenge'; end if;
  if my_room.active_pk_match_id is not null then raise exception 'already in a PK match'; end if;

  select * into their_room from public.live_rooms
    where host_id = _to_host and status = 'live'
    order by created_at desc limit 1;
  if their_room.id is null then raise exception 'opponent is not live'; end if;
  if their_room.active_pk_match_id is not null then raise exception 'opponent already in a PK'; end if;

  -- expire any old pendings between these two
  update public.pk_invites
     set status = 'expired'
   where status = 'pending'
     and ((from_host = me and to_host = _to_host)
       or (from_host = _to_host and to_host = me));

  insert into public.pk_invites(from_host, to_host, from_room, to_room, duration_sec)
  values (me, _to_host, my_room.id, their_room.id, _duration_sec)
  returning * into inv;

  return inv;
end;
$$;

grant execute on function public.pk_send_invite(uuid, int) to authenticated;

-- 6) Respond to invite (accept/decline) -------------------------
create or replace function public.pk_respond_invite(_invite_id uuid, _accept boolean)
returns public.pk_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  inv public.pk_invites;
  m public.pk_matches;
  my_room public.live_rooms;
begin
  if me is null then raise exception 'auth required'; end if;

  select * into inv from public.pk_invites where id = _invite_id for update;
  if inv.id is null then raise exception 'invite not found'; end if;
  if inv.to_host <> me then raise exception 'not your invite'; end if;
  if inv.status <> 'pending' then raise exception 'invite already handled'; end if;
  if inv.expires_at < now() then
    update public.pk_invites set status = 'expired' where id = inv.id;
    raise exception 'invite expired';
  end if;

  if not _accept then
    update public.pk_invites set status = 'declined', responded_at = now() where id = inv.id;
    return null;
  end if;

  -- my (accepting host) current live room
  select * into my_room from public.live_rooms
    where host_id = me and status = 'live'
    order by created_at desc limit 1;
  if my_room.id is null then raise exception 'you must be live to accept'; end if;
  if my_room.active_pk_match_id is not null then raise exception 'you are already in a PK'; end if;

  insert into public.pk_matches(host_a, host_b, room_a, room_b, duration_sec, ends_at)
  values (inv.from_host, me, inv.from_room, my_room.id, inv.duration_sec, now() + make_interval(secs => inv.duration_sec))
  returning * into m;

  update public.live_rooms set active_pk_match_id = m.id where id in (m.room_a, m.room_b);
  update public.pk_invites set status = 'accepted', responded_at = now(), match_id = m.id where id = inv.id;

  return m;
end;
$$;

grant execute on function public.pk_respond_invite(uuid, boolean) to authenticated;

-- 7) End match (host, admin, or auto on expiry) ------------------
create or replace function public.pk_end_match(_match_id uuid)
returns public.pk_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  m public.pk_matches;
  s record;
  win uuid;
begin
  select * into m from public.pk_matches where id = _match_id for update;
  if m.id is null then raise exception 'match not found'; end if;
  if m.status <> 'active' then return m; end if;

  -- Only participants, admins, or auto-close after end can finalize
  if me is not null and me <> m.host_a and me <> m.host_b then
    if not public.has_role(me, 'admin'::app_role) then
      raise exception 'not a participant';
    end if;
  end if;

  select score_a, score_b into s from public.pk_match_score(m.id);
  win := case
    when s.score_a > s.score_b then m.host_a
    when s.score_b > s.score_a then m.host_b
    else null
  end;

  update public.pk_matches
     set status = 'ended', ended_at = now(),
         score_a = s.score_a, score_b = s.score_b,
         winner_id = win
   where id = m.id
  returning * into m;

  update public.live_rooms set active_pk_match_id = null
   where id in (m.room_a, m.room_b) and active_pk_match_id = m.id;

  -- history rows for both hosts (best-effort)
  insert into public.pk_battles(host_id, room_id, room_title, my_score, opponent_name, opponent_score, result, started_at, ended_at)
  select m.host_a, m.room_a,
         coalesce((select title from public.live_rooms where id = m.room_a), 'PK Battle'),
         s.score_a,
         coalesce((select username from public.profiles where id = m.host_b), 'Opponent'),
         s.score_b,
         case when win = m.host_a then 'win' when win = m.host_b then 'lose' else 'draw' end,
         m.started_at, now();

  insert into public.pk_battles(host_id, room_id, room_title, my_score, opponent_name, opponent_score, result, started_at, ended_at)
  select m.host_b, m.room_b,
         coalesce((select title from public.live_rooms where id = m.room_b), 'PK Battle'),
         s.score_b,
         coalesce((select username from public.profiles where id = m.host_a), 'Opponent'),
         s.score_a,
         case when win = m.host_b then 'win' when win = m.host_a then 'lose' else 'draw' end,
         m.started_at, now();

  return m;
end;
$$;

grant execute on function public.pk_end_match(uuid) to authenticated;

-- 8) Realtime ----------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pk_invites') then
    execute 'alter publication supabase_realtime add table public.pk_invites';
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pk_matches') then
    execute 'alter publication supabase_realtime add table public.pk_matches';
  end if;
end$$;

alter table public.pk_invites  replica identity full;
alter table public.pk_matches  replica identity full;
