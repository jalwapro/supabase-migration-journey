-- Fix host popularity calculation/database mismatches.
-- 1) Daily task gifts must use today's host-received gift diamonds, not all-time gifts.
-- 2) Activity checkpoints move active_session_started_at forward so the UI's
--    live-now delta does not repeatedly add the entire session duration.
-- 3) Keep session_end authoritative for the final remainder of a session.

create or replace function public.host_popularity_record_activity(
  _room_id uuid,
  _live_seconds integer default 0,
  _popularity_delta integer default 0,
  _gifts_power_delta integer default 0,
  _tasks_delta integer default 0
)
returns public.host_popularity_stats
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  host_user uuid;
  r public.host_popularity_stats;
  today date := current_date;
  week_start date := date_trunc('week', today)::date;
  safe_live integer := greatest(0, least(coalesce(_live_seconds, 0), 300));
  safe_pop integer := greatest(0, least(coalesce(_popularity_delta, 0), 500));
  safe_gifts integer := greatest(0, least(coalesce(_gifts_power_delta, 0), 1000000));
  safe_tasks integer := greatest(0, least(coalesce(_tasks_delta, 0), 100));
begin
  if me is null then raise exception 'not authenticated'; end if;

  select host_id into host_user
  from public.live_rooms
  where id = _room_id;

  if host_user is null then raise exception 'room not found'; end if;
  if me <> host_user then raise exception 'only the room host can record host activity'; end if;

  insert into public.host_popularity_stats(host_id)
  values (host_user)
  on conflict (host_id) do nothing;

  update public.host_popularity_stats
  set
    today_live_seconds = case when current_day = today then today_live_seconds else 0 end,
    week_live_seconds = case when current_week_start = week_start then week_live_seconds else 0 end,
    current_day = today,
    current_week_start = week_start
  where host_id = host_user;

  update public.host_popularity_stats
  set
    cumulative_popularity = cumulative_popularity + safe_pop,
    total_live_seconds = total_live_seconds + safe_live,
    today_live_seconds = today_live_seconds + safe_live,
    week_live_seconds = week_live_seconds + safe_live,
    gifts_power = gifts_power + safe_gifts,
    tasks_completed = tasks_completed + safe_tasks,
    streak_days = case
      when last_live_date = today then streak_days
      when last_live_date = today - 1 then streak_days + 1
      else 1
    end,
    last_live_date = today,
    active_session_started_at = case when safe_live > 0 then now() else active_session_started_at end,
    updated_at = now()
  where host_id = host_user
  returning * into r;

  return r;
end;
$$;

grant execute on function public.host_popularity_record_activity(uuid, integer, integer, integer, integer) to authenticated;

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

  -- The active-session timestamp is the last checkpoint. Therefore only the
  -- unpersisted tail of the current session is added to the displayed values.
  if v_started is not null then
    v_live_now := greatest(0, least(extract(epoch from (now() - v_started))::bigint, 86400));
  end if;

  v_today_live := v_today_live + v_live_now;
  v_total_live := v_total_live + v_live_now;
  v_week_live := v_week_live + v_live_now;

  -- Daily gift target is based on host-received diamonds earned today.
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
  select
    _host_id,
    v_cumulative,
    v_total_live,
    v_today_live,
    v_week_live,
    v_gifts_power,
    v_tasks_completed,
    v_task_target,
    v_streak,
    0.0::numeric,
    0.0::numeric,
    v_red_diamonds,
    v_pkr_val;
end;
$$;

grant execute on function public.host_popularity_get_v2(uuid) to authenticated;
