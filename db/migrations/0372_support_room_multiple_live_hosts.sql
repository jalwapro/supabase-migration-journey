-- 0372: Allow multiple assigned customer-support hosts to be live in the same permanent room.
-- Uses the existing support room and LiveKit channel; no LiveKit server/token APIs are changed.

create or replace function public.support_host_go_live()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_cfg public.support_room_config;
  v_room uuid;
  v_session uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.support_is_host(v_uid) then raise exception 'NOT_SUPPORT_HOST'; end if;

  select * into v_cfg from public.support_room_config where id;
  if not v_cfg.enabled or v_cfg.maintenance then raise exception 'SUPPORT_ROOM_UNAVAILABLE'; end if;

  -- Each assigned host may start their own session; all sessions share the permanent support room.
  v_room := public.support_ensure_room(v_uid);

  select id into v_session
    from public.support_room_sessions
   where host_id = v_uid and ended_at is null
   limit 1;
  if v_session is null then
    insert into public.support_room_sessions (host_id)
    values (v_uid)
    returning id into v_session;
  end if;

  perform public.support_log(v_uid, null, 'host_go_live', jsonb_build_object('room', v_room, 'session', v_session));
  return jsonb_build_object('room_id', v_room, 'session_id', v_session);
end $$;

create or replace function public.support_host_end()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_ended integer := 0;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not (public.support_is_host(v_uid) or public.is_admin(v_uid)) then raise exception 'FORBIDDEN'; end if;

  if public.is_admin(v_uid) then
    update public.support_room_sessions set ended_at = now() where ended_at is null;
    get diagnostics v_ended = row_count;
  else
    update public.support_room_sessions set ended_at = now()
     where host_id = v_uid and ended_at is null;
    get diagnostics v_ended = row_count;
  end if;

  if v_ended = 0 then return; end if;

  -- Keep callers and the queue connected while any support host remains live.
  if not exists (select 1 from public.support_room_sessions where ended_at is null) then
    delete from public.support_room_seats;
    delete from public.support_room_queue;
    update public.live_rooms
       set status = 'ended', ended_at = now()
     where id = (select room_id from public.support_room_config where id);
  end if;

  perform public.support_log(v_uid, null, 'host_end', jsonb_build_object('sessions_ended', v_ended));
end $$;

create or replace function public.support_room_state()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_cfg public.support_room_config;
  v_session public.support_room_sessions;
begin
  select * into v_cfg from public.support_room_config where id;
  select * into v_session
    from public.support_room_sessions
   where ended_at is null
   order by started_at asc
   limit 1;

  return jsonb_build_object(
    'config', to_jsonb(v_cfg),
    'online', exists (select 1 from public.support_room_sessions where ended_at is null),
    'session', to_jsonb(v_session),
    'host', (
      select jsonb_build_object('id', p.id, 'username', p.username, 'avatar', p.avatar)
        from public.profiles p
       where p.id = v_session.host_id
    ),
    'hosts_live', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'avatar', p.avatar,
        'session_id', s.id
      ) order by s.started_at)
        from public.support_room_sessions s
        join public.profiles p on p.id = s.host_id
       where s.ended_at is null
    ), '[]'::jsonb),
    'seats', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', s.seat_index, 'muted', s.muted, 'joined_at', s.joined_at,
        'user', jsonb_build_object('id', p.id, 'username', p.username, 'avatar', p.avatar))
        order by s.seat_index)
        from public.support_room_seats s
        join public.profiles p on p.id = s.user_id
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

grant execute on function public.support_host_go_live() to authenticated;
grant execute on function public.support_host_end() to authenticated;
grant execute on function public.support_room_state() to authenticated, anon;
