-- Qualify the upsert-free insert in the table-returning RPC.
-- PL/pgSQL output columns become variables, so ON CONFLICT(host_id)
-- can be ambiguous inside the function body.

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

  insert into public.host_popularity_stats as hs (host_id)
  values (_host_id)
  on conflict do nothing;

  update public.host_popularity_stats as hs
  set
    today_live_seconds = case when hs.current_day = current_date then hs.today_live_seconds else 0 end,
    week_live_seconds = case when hs.current_week_start = date_trunc('week', current_date)::date then hs.week_live_seconds else 0 end,
    current_day = current_date,
    current_week_start = date_trunc('week', current_date)::date,
    updated_at = now()
  where hs.host_id = _host_id;

  select
    coalesce(hs.today_live_seconds, 0),
    coalesce(hs.total_live_seconds, 0),
    coalesce(hs.week_live_seconds, 0),
    coalesce(hs.gifts_power, 0),
    coalesce(hs.cumulative_popularity, 0),
    coalesce(hs.streak_days, 0),
    hs.active_session_started_at
  into v_today_live, v_total_live, v_week_live, v_gifts_power, v_cumulative, v_streak, v_started
  from public.host_popularity_stats as hs
  where hs.host_id = _host_id;

  if v_started is null then
    select min(lr.created_at)
      into v_room_started
      from public.live_rooms as lr
     where lr.host_id = _host_id
       and lr.status::text = 'live'
       and lr.ended_at is null;

    if v_room_started is not null then
      v_started := v_room_started;
      update public.host_popularity_stats as hs
      set active_session_started_at = v_started,
          updated_at = now()
      where hs.host_id = _host_id
        and hs.active_session_started_at is null;
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
    from public.gift_sends as g
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
  select _host_id,
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
