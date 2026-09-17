-- Make host live-time accounting follow the canonical live room lifecycle.
-- A live room is the source of truth when no heartbeat checkpoint exists.

create or replace function public.host_popularity_session_start(_room_id uuid)
returns public.host_popularity_stats
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  host_user uuid;
  room_started timestamptz;
  r public.host_popularity_stats;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select host_id, created_at into host_user, room_started
  from public.live_rooms
  where id = _room_id;

  if host_user is null then raise exception 'room not found'; end if;
  if me <> host_user then raise exception 'only the room host can start host tracking'; end if;

  insert into public.host_popularity_stats(host_id)
  values (host_user)
  on conflict (host_id) do nothing;

  update public.host_popularity_stats
  set active_session_started_at = coalesce(active_session_started_at, room_started, now()),
      updated_at = now()
  where host_id = host_user
  returning * into r;

  return r;
end;
$$;

grant execute on function public.host_popularity_session_start(uuid) to authenticated;

create or replace function public.host_popularity_get_v2(_host_id uuid)
returns table(
  host_id uuid,
  cumulative_popularity bigint,
  total_live_seconds bigint,
  today_live_seconds bigint,
  week_live_seconds bigint,
  gifts_power bigint,
  tasks_completed integer,
  task_target integer,
  streak_days integer,
  host_bonus numeric,
  host_commission numeric,
  red_diamonds bigint,
  red_diamonds_pkr_value numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today_live bigint := 0;
  v_total_live bigint := 0;
  v_week_live bigint := 0;
  v_gifts_power bigint := 0;
  v_cumulative bigint := 0;
  v_streak int := 0;
  v_today_gifts bigint := 0;
  v_tasks_completed int := 0;
  v_task_target int := 100;
  v_red_diamonds bigint := 0;
  v_pkr_val numeric := 500;
  v_started timestamptz;
  v_room_started timestamptz;
  v_live_now bigint := 0;
begin
  if _host_id is null then raise exception 'host id is required'; end if;

  insert into public.host_popularity_stats(host_id)
  values (_host_id)
  on conflict (host_id) do nothing;

  update public.host_popularity_stats
  set
    today_live_seconds = case when current_day = current_date then today_live_seconds else 0 end,
    week_live_seconds = case when current_week_start = date_trunc('week', current_date)::date then week_live_seconds else 0 end,
    current_day = current_date,
    current_week_start = date_trunc('week', current_date)::date,
    updated_at = now()
  where host_id = _host_id;

  select
    coalesce(s.today_live_seconds, 0),
    coalesce(s.total_live_seconds, 0),
    coalesce(s.week_live_seconds, 0),
    coalesce(s.gifts_power, 0),
    coalesce(s.cumulative_popularity, 0),
    coalesce(s.streak_days, 0),
    s.active_session_started_at
  into v_today_live, v_total_live, v_week_live, v_gifts_power, v_cumulative, v_streak, v_started
  from public.host_popularity_stats s
  where s.host_id = _host_id;

  -- If the host is currently live but no heartbeat/session checkpoint exists,
  -- use the canonical room creation timestamp as the live-session start.
  if v_started is null then
    select min(lr.created_at) into v_room_started
    from public.live_rooms lr
    where lr.host_id = _host_id
      and lr.status::text = 'live'
      and lr.ended_at is null;

    if v_room_started is not null then
      v_started := v_room_started;
      update public.host_popularity_stats
      set active_session_started_at = v_started, updated_at = now()
      where host_id = _host_id
        and active_session_started_at is null;
    end if;
  end if;

  if v_started is not null then
    v_live_now := greatest(0, least(extract(epoch from (now() - v_started))::bigint, 86400));
  end if;

  v_today_live := v_today_live + v_live_now;
  v_total_live := v_total_live + v_live_now;
  v_week_live := v_week_live + v_live_now;

  select coalesce(sum(g.diamonds_earned), 0)
    into v_today_gifts
    from public.gift_sends g
   where g.receiver_id = _host_id
     and g.created_at >= current_date::timestamptz
     and g.created_at < (current_date + 1)::timestamptz;

  v_tasks_completed := least(
    100,
    floor((v_today_live::numeric / 21600.0) * 50)::int
    + floor(least(v_today_gifts::numeric / 1000000.0, 1.0) * 50)::int
  );

  if v_today_live >= 21600 and v_today_gifts >= 1000000 then
    v_tasks_completed := 100;
    v_red_diamonds := 100000;
  end if;

  return query
  select _host_id, v_cumulative, v_total_live, v_today_live, v_week_live,
         v_gifts_power, v_tasks_completed, v_task_target, v_streak,
         0.0::numeric, 0.0::numeric, v_red_diamonds, v_pkr_val;
end;
$$;

grant execute on function public.host_popularity_get_v2(uuid) to authenticated;

-- Persist the current host session before the canonical room-end mutation.
create or replace function public.room_end(_room_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_host uuid;
begin
  select host_id into v_host from public.live_rooms where id = _room_id;
  if v_host is null then raise exception 'Room not found'; end if;
  if auth.uid() <> v_host then raise exception 'Only the host can end the room'; end if;

  perform public.host_popularity_session_start(_room_id);
  perform public.host_popularity_session_end(_room_id);

  update public.live_rooms
     set status = 'ended', ended_at = now()
   where id = _room_id
     and status <> 'ended';

  delete from public.room_participants where room_id = _room_id;
end;
$$;

grant execute on function public.room_end(uuid) to authenticated;
