-- 0372 — Host-profile linked cumulative popularity
-- Progress belongs to the host profile (auth.users.id), not a single live room.

create table if not exists public.host_popularity_stats (
  host_id uuid primary key references auth.users(id) on delete cascade,
  cumulative_popularity bigint not null default 0,
  total_live_seconds bigint not null default 0,
  today_live_seconds bigint not null default 0,
  week_live_seconds bigint not null default 0,
  gifts_power bigint not null default 0,
  tasks_completed bigint not null default 0,
  task_target bigint not null default 100,
  streak_days integer not null default 0,
  last_live_date date,
  current_day date not null default current_date,
  current_week_start date not null default date_trunc('week', current_date)::date,
  host_bonus numeric(18,2) not null default 0,
  host_commission numeric(18,2) not null default 0,
  active_session_started_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists host_popularity_stats_updated_idx
  on public.host_popularity_stats(updated_at desc);

alter table public.host_popularity_stats enable row level security;

drop policy if exists "host popularity readable" on public.host_popularity_stats;
create policy "host popularity readable"
  on public.host_popularity_stats for select
  to authenticated
  using (true);

create or replace function public.host_popularity_get(_host_id uuid)
returns public.host_popularity_stats
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.host_popularity_stats;
  today date := current_date;
  week_start date := date_trunc('week', today)::date;
begin
  if _host_id is null then
    raise exception 'host id is required';
  end if;

  insert into public.host_popularity_stats(host_id)
  values (_host_id)
  on conflict (host_id) do nothing;

  update public.host_popularity_stats
  set
    today_live_seconds = case when current_day = today then today_live_seconds else 0 end,
    week_live_seconds = case when current_week_start = week_start then week_live_seconds else 0 end,
    current_day = today,
    current_week_start = week_start,
    updated_at = now()
  where host_id = _host_id;

  select * into r
  from public.host_popularity_stats
  where host_id = _host_id;

  return r;
end;
$$;

grant execute on function public.host_popularity_get(uuid) to authenticated;

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
    active_session_started_at = coalesce(active_session_started_at, now()),
    updated_at = now()
  where host_id = host_user
  returning * into r;

  return r;
end;
$$;

grant execute on function public.host_popularity_record_activity(uuid, integer, integer, integer, integer) to authenticated;

create or replace function public.host_popularity_session_start(_room_id uuid)
returns public.host_popularity_stats
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  host_user uuid;
  r public.host_popularity_stats;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select host_id into host_user from public.live_rooms where id = _room_id;
  if host_user is null then raise exception 'room not found'; end if;
  if me <> host_user then raise exception 'only the room host can start host tracking'; end if;

  insert into public.host_popularity_stats(host_id)
  values (host_user)
  on conflict (host_id) do nothing;

  update public.host_popularity_stats
  set active_session_started_at = coalesce(active_session_started_at, now()), updated_at = now()
  where host_id = host_user
  returning * into r;
  return r;
end;
$$;

grant execute on function public.host_popularity_session_start(uuid) to authenticated;

create or replace function public.host_popularity_session_end(_room_id uuid)
returns public.host_popularity_stats
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  host_user uuid;
  started timestamptz;
  seconds integer;
  r public.host_popularity_stats;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select host_id into host_user from public.live_rooms where id = _room_id;
  if host_user is null then raise exception 'room not found'; end if;
  if me <> host_user then raise exception 'only the room host can end host tracking'; end if;

  select active_session_started_at into started
  from public.host_popularity_stats
  where host_id = host_user;

  seconds := greatest(0, least(coalesce(extract(epoch from (now() - started))::integer, 86400), 86400));

  if seconds > 0 then
    update public.host_popularity_stats
    set total_live_seconds = total_live_seconds + seconds,
        today_live_seconds = case when current_day = current_date then today_live_seconds + seconds else seconds end,
        week_live_seconds = case when current_week_start = date_trunc('week', current_date)::date then week_live_seconds + seconds else seconds end,
        streak_days = case when last_live_date = current_date then streak_days when last_live_date = current_date - 1 then streak_days + 1 else 1 end,
        last_live_date = current_date,
        active_session_started_at = null,
        current_day = current_date,
        current_week_start = date_trunc('week', current_date)::date,
        updated_at = now()
    where host_id = host_user;
  else
    update public.host_popularity_stats set active_session_started_at = null, updated_at = now() where host_id = host_user;
  end if;

  select * into r from public.host_popularity_stats where host_id = host_user;
  return r;
end;
$$;

grant execute on function public.host_popularity_session_end(uuid) to authenticated;

-- Keep realtime available for the popup when the host stats change.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'host_popularity_stats'
  ) then
    execute 'alter publication supabase_realtime add table public.host_popularity_stats';
  end if;
  execute 'alter table public.host_popularity_stats replica identity full';
end $$;
