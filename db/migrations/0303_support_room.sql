-- 0303: 24/7 Customer Support Voice Room
-- One permanent room: 1 support host + 2 users at a time, everyone else waits
-- in a server-managed FIFO queue. All capacity/authorisation checks are
-- enforced inside security-definer RPCs — the client can never seat itself.

create table if not exists public.support_room_config (
  id boolean primary key default true check (id),
  room_id uuid references public.live_rooms(id) on delete set null,
  title text not null default '24/7 Customer Support',
  cover_url text,
  enabled boolean not null default true,
  maintenance boolean not null default false,
  max_users integer not null default 2 check (max_users between 1 and 8),
  announcement text,
  updated_at timestamptz not null default now()
);
insert into public.support_room_config (id) values (true) on conflict (id) do nothing;

create table if not exists public.support_hosts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  is_active boolean not null default true,
  priority integer not null default 0,
  note text,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.support_room_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  users_served integer not null default 0
);
create unique index if not exists uniq_support_session_open
  on public.support_room_sessions (host_id) where ended_at is null;

create table if not exists public.support_room_seats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  seat_index integer not null check (seat_index between 1 and 8),
  session_id uuid references public.support_room_sessions(id) on delete set null,
  muted boolean not null default false,
  joined_at timestamptz not null default now()
);
create unique index if not exists uniq_support_seat_user on public.support_room_seats (user_id);
create unique index if not exists uniq_support_seat_index on public.support_room_seats (seat_index);

create table if not exists public.support_room_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade unique,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_support_queue_order on public.support_room_queue (created_at);

create table if not exists public.support_room_logs (
  id bigserial primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  target_id uuid references public.profiles(id) on delete set null,
  action text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_support_logs_created on public.support_room_logs (created_at desc);

grant select on public.support_room_config, public.support_hosts, public.support_room_seats,
  public.support_room_queue, public.support_room_sessions to authenticated;
grant select on public.support_room_config to anon;
grant all on public.support_room_config, public.support_hosts, public.support_room_seats,
  public.support_room_queue, public.support_room_sessions, public.support_room_logs to service_role;
grant usage, select on sequence public.support_room_logs_id_seq to service_role;

alter table public.support_room_config enable row level security;
alter table public.support_hosts enable row level security;
alter table public.support_room_sessions enable row level security;
alter table public.support_room_seats enable row level security;
alter table public.support_room_queue enable row level security;
alter table public.support_room_logs enable row level security;

drop policy if exists "support config public read" on public.support_room_config;
create policy "support config public read" on public.support_room_config for select using (true);

drop policy if exists "support hosts readable" on public.support_hosts;
create policy "support hosts readable" on public.support_hosts for select to authenticated using (true);

drop policy if exists "support sessions readable" on public.support_room_sessions;
create policy "support sessions readable" on public.support_room_sessions for select to authenticated using (true);

drop policy if exists "support seats readable" on public.support_room_seats;
create policy "support seats readable" on public.support_room_seats for select to authenticated using (true);

drop policy if exists "support queue readable" on public.support_room_queue;
create policy "support queue readable" on public.support_room_queue for select to authenticated using (true);

drop policy if exists "support logs admin only" on public.support_room_logs;
create policy "support logs admin only" on public.support_room_logs for select to authenticated
  using (public.is_admin(auth.uid()));

-- ------------------------------------------------------------------ helpers
create or replace function public.support_is_host(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.support_hosts h where h.user_id = _uid and h.is_active);
$$;

create or replace function public.support_log(_actor uuid, _target uuid, _action text, _meta jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.support_room_logs (actor_id, target_id, action, meta)
  values (_actor, _target, _action, coalesce(_meta, '{}'::jsonb));
$$;

-- Ensures the single permanent support room exists and is hosted by _host.
create or replace function public.support_ensure_room(_host uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_cfg public.support_room_config; v_room uuid;
begin
  select * into v_cfg from public.support_room_config where id;
  v_room := v_cfg.room_id;

  if v_room is not null and not exists (select 1 from public.live_rooms where id = v_room) then
    v_room := null;
  end if;

  if v_room is null then
    insert into public.live_rooms (host_id, title, cover_url, room_type, status, rtc_channel, seat_count)
    values (_host, coalesce(v_cfg.title, '24/7 Customer Support'), v_cfg.cover_url, 'voice', 'live',
            'jalwa-support-247', coalesce(v_cfg.max_users, 2) + 1)
    on conflict (rtc_channel) do update set host_id = excluded.host_id, status = 'live', ended_at = null
    returning id into v_room;
    update public.support_room_config set room_id = v_room, updated_at = now() where id;
  else
    update public.live_rooms
       set host_id = _host, status = 'live', ended_at = null,
           heartbeat_at = now(), host_last_seen_at = now(),
           title = coalesce(v_cfg.title, title),
           seat_count = coalesce(v_cfg.max_users, 2) + 1
     where id = v_room;
  end if;

  return v_room;
end $$;

-- --------------------------------------------------------------- host flows
create or replace function public.support_host_go_live()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_cfg public.support_room_config; v_room uuid; v_session uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.support_is_host(v_uid) then raise exception 'NOT_SUPPORT_HOST'; end if;

  select * into v_cfg from public.support_room_config where id;
  if not v_cfg.enabled or v_cfg.maintenance then raise exception 'SUPPORT_ROOM_UNAVAILABLE'; end if;

  -- only one host may be live at a time
  if exists (select 1 from public.support_room_sessions where ended_at is null and host_id <> v_uid) then
    raise exception 'ANOTHER_HOST_LIVE';
  end if;

  v_room := public.support_ensure_room(v_uid);

  select id into v_session from public.support_room_sessions where host_id = v_uid and ended_at is null;
  if v_session is null then
    insert into public.support_room_sessions (host_id) values (v_uid) returning id into v_session;
  end if;

  perform public.support_log(v_uid, null, 'host_go_live', jsonb_build_object('room', v_room));
  return jsonb_build_object('room_id', v_room, 'session_id', v_session);
end $$;

create or replace function public.support_host_end()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_session uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select id into v_session from public.support_room_sessions where ended_at is null
   and (host_id = v_uid or public.is_admin(v_uid)) limit 1;
  if v_session is null then return; end if;

  update public.support_room_sessions set ended_at = now() where id = v_session;
  delete from public.support_room_seats;
  delete from public.support_room_queue;
  update public.live_rooms set status = 'ended', ended_at = now()
   where id = (select room_id from public.support_room_config where id);
  perform public.support_log(v_uid, null, 'host_end', '{}'::jsonb);
end $$;

create or replace function public.support_host_kick(_target uuid, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not (public.support_is_host(v_uid) or public.is_admin(v_uid)) then raise exception 'FORBIDDEN'; end if;
  delete from public.support_room_seats where user_id = _target;
  delete from public.support_room_queue where user_id = _target;
  perform public.support_log(v_uid, _target, 'kick', jsonb_build_object('reason', _reason));
end $$;

create or replace function public.support_host_set_mute(_target uuid, _muted boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not (public.support_is_host(v_uid) or public.is_admin(v_uid)) then raise exception 'FORBIDDEN'; end if;
  update public.support_room_seats set muted = coalesce(_muted, false) where user_id = _target;
  perform public.support_log(v_uid, _target, 'mute', jsonb_build_object('muted', _muted));
end $$;

-- --------------------------------------------------------------- user flows
-- Join: takes a free seat, otherwise appends to the FIFO waiting queue.
create or replace function public.support_join(_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_cfg public.support_room_config; v_session uuid;
  v_seat int; v_taken int; v_pos int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_cfg from public.support_room_config where id;
  if not v_cfg.enabled then raise exception 'SUPPORT_ROOM_DISABLED'; end if;
  if v_cfg.maintenance then raise exception 'SUPPORT_ROOM_MAINTENANCE'; end if;

  select id into v_session from public.support_room_sessions where ended_at is null limit 1;
  if v_session is null then raise exception 'NO_HOST_ONLINE'; end if;

  if public.support_is_host(v_uid) then
    return jsonb_build_object('status', 'host', 'room_id', v_cfg.room_id);
  end if;

  -- already seated?
  select seat_index into v_seat from public.support_room_seats where user_id = v_uid;
  if v_seat is not null then
    return jsonb_build_object('status', 'seated', 'seat', v_seat, 'room_id', v_cfg.room_id);
  end if;

  perform pg_advisory_xact_lock(hashtext('jalwa_support_room'));

  select count(*) into v_taken from public.support_room_seats;
  if v_taken < v_cfg.max_users then
    select g into v_seat from generate_series(1, v_cfg.max_users) g
     where g not in (select seat_index from public.support_room_seats)
     order by g limit 1;
    insert into public.support_room_seats (user_id, seat_index, session_id)
    values (v_uid, v_seat, v_session);
    delete from public.support_room_queue where user_id = v_uid;
    update public.support_room_sessions set users_served = users_served + 1 where id = v_session;
    perform public.support_log(v_uid, null, 'seat_taken', jsonb_build_object('seat', v_seat));
    return jsonb_build_object('status', 'seated', 'seat', v_seat, 'room_id', v_cfg.room_id);
  end if;

  insert into public.support_room_queue (user_id, reason) values (v_uid, _reason)
  on conflict (user_id) do update set reason = coalesce(excluded.reason, support_room_queue.reason);

  select count(*) into v_pos from public.support_room_queue q
   where q.created_at <= (select created_at from public.support_room_queue where user_id = v_uid);

  return jsonb_build_object('status', 'waiting', 'position', v_pos, 'room_id', v_cfg.room_id);
end $$;

create or replace function public.support_leave()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  delete from public.support_room_seats where user_id = v_uid;
  delete from public.support_room_queue where user_id = v_uid;
  perform public.support_log(v_uid, null, 'leave', '{}'::jsonb);
end $$;

-- Full live state for the support room UI.
create or replace function public.support_room_state()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_cfg public.support_room_config; v_session public.support_room_sessions;
begin
  select * into v_cfg from public.support_room_config where id;
  select * into v_session from public.support_room_sessions where ended_at is null limit 1;

  return jsonb_build_object(
    'config', to_jsonb(v_cfg),
    'online', v_session.id is not null,
    'session', to_jsonb(v_session),
    'host', (
      select jsonb_build_object('id', p.id, 'username', p.username, 'avatar', p.avatar)
      from public.profiles p where p.id = v_session.host_id
    ),
    'seats', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', s.seat_index, 'muted', s.muted, 'joined_at', s.joined_at,
        'user', jsonb_build_object('id', p.id, 'username', p.username, 'avatar', p.avatar))
        order by s.seat_index)
      from public.support_room_seats s join public.profiles p on p.id = s.user_id
    ), '[]'::jsonb),
    'queue_count', (select count(*) from public.support_room_queue),
    'my_seat', (select seat_index from public.support_room_seats where user_id = v_uid),
    'my_position', (
      select count(*) from public.support_room_queue q
      where q.created_at <= (select created_at from public.support_room_queue where user_id = v_uid)
    ),
    'is_host', public.support_is_host(v_uid),
    'is_admin', public.is_admin(v_uid)
  );
end $$;

-- -------------------------------------------------------------------- admin
create or replace function public.support_admin_set_host(_user uuid, _active boolean default true, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_admin(v_uid) then raise exception 'FORBIDDEN'; end if;
  insert into public.support_hosts (user_id, is_active, note, added_by)
  values (_user, coalesce(_active, true), _note, v_uid)
  on conflict (user_id) do update set is_active = excluded.is_active, note = coalesce(excluded.note, support_hosts.note);
  perform public.support_log(v_uid, _user, 'set_host', jsonb_build_object('active', _active));
end $$;

create or replace function public.support_admin_remove_host(_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_admin(v_uid) then raise exception 'FORBIDDEN'; end if;
  delete from public.support_hosts where user_id = _user;
  update public.support_room_sessions set ended_at = now() where host_id = _user and ended_at is null;
  perform public.support_log(v_uid, _user, 'remove_host', '{}'::jsonb);
end $$;

create or replace function public.support_admin_config(
  _title text default null, _enabled boolean default null, _maintenance boolean default null,
  _max_users integer default null, _announcement text default null, _cover_url text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_cfg public.support_room_config;
begin
  if not public.is_admin(v_uid) then raise exception 'FORBIDDEN'; end if;
  update public.support_room_config set
    title = coalesce(_title, title),
    enabled = coalesce(_enabled, enabled),
    maintenance = coalesce(_maintenance, maintenance),
    max_users = coalesce(_max_users, max_users),
    announcement = coalesce(_announcement, announcement),
    cover_url = coalesce(_cover_url, cover_url),
    updated_at = now()
  where id
  returning * into v_cfg;
  perform public.support_log(v_uid, null, 'config', to_jsonb(v_cfg));
  return to_jsonb(v_cfg);
end $$;

create or replace function public.support_admin_overview(_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_admin(v_uid) then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'state', public.support_room_state(),
    'hosts', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', h.user_id, 'is_active', h.is_active,
        'note', h.note, 'created_at', h.created_at,
        'username', p.username, 'avatar', p.avatar) order by h.created_at)
      from public.support_hosts h left join public.profiles p on p.id = h.user_id), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'host_id', s.host_id, 'username', p.username,
        'started_at', s.started_at, 'ended_at', s.ended_at, 'users_served', s.users_served)
        order by s.started_at desc)
      from (select * from public.support_room_sessions order by started_at desc limit greatest(1, least(coalesce(_limit,50),200))) s
      left join public.profiles p on p.id = s.host_id), '[]'::jsonb),
    'queue', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', q.user_id, 'username', p.username,
        'reason', q.reason, 'created_at', q.created_at) order by q.created_at)
      from public.support_room_queue q left join public.profiles p on p.id = q.user_id), '[]'::jsonb),
    'logs', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.created_at desc)
      from (select * from public.support_room_logs order by created_at desc limit 100) l), '[]'::jsonb)
  );
end $$;

grant execute on function public.support_is_host(uuid) to authenticated;
grant execute on function public.support_room_state() to authenticated, anon;
grant execute on function public.support_join(text) to authenticated;
grant execute on function public.support_leave() to authenticated;
grant execute on function public.support_host_go_live() to authenticated;
grant execute on function public.support_host_end() to authenticated;
grant execute on function public.support_host_kick(uuid, text) to authenticated;
grant execute on function public.support_host_set_mute(uuid, boolean) to authenticated;
grant execute on function public.support_admin_set_host(uuid, boolean, text) to authenticated;
grant execute on function public.support_admin_remove_host(uuid) to authenticated;
grant execute on function public.support_admin_config(text, boolean, boolean, integer, text, text) to authenticated;
grant execute on function public.support_admin_overview(int) to authenticated;

revoke execute on function public.support_ensure_room(uuid) from authenticated, anon;
revoke execute on function public.support_log(uuid, uuid, text, jsonb) from authenticated, anon;
