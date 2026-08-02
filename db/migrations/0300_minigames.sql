-- 0300_minigames.sql — Mini Games Center: server-authoritative engine
begin;

-- =====================================================================
-- CATALOGUE
-- =====================================================================
create table if not exists public.mini_games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  icon text,
  color text not null default '#ffcf6a',
  category text not null default 'arcade',
  enabled boolean not null default true,
  maintenance boolean not null default false,
  entry_cost bigint not null default 0,
  reward_base bigint not null default 0,
  xp_reward integer not null default 0,
  daily_limit integer not null default 0,          -- 0 = unlimited
  cooldown_seconds integer not null default 0,
  difficulty text not null default 'medium',       -- easy | medium | hard
  min_duration_ms integer not null default 1500,   -- anti-cheat floor
  max_duration_ms integer not null default 900000,
  max_score integer not null default 1000000,
  sort_order integer not null default 100,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.mini_games to anon, authenticated;
grant all on public.mini_games to service_role;
alter table public.mini_games enable row level security;

drop policy if exists "mini_games read" on public.mini_games;
create policy "mini_games read" on public.mini_games
  for select using (enabled or public.is_admin(auth.uid()));

drop policy if exists "mini_games admin" on public.mini_games;
create policy "mini_games admin" on public.mini_games
  to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- =====================================================================
-- SESSIONS (single source of truth for a play)
-- =====================================================================
create table if not exists public.mini_game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.mini_games(id) on delete cascade,
  slug text not null,
  status text not null default 'active',           -- active | finished | expired
  entry_cost bigint not null default 0,
  server_seed text not null default encode(gen_random_bytes(16), 'hex'),
  payload jsonb not null default '{}'::jsonb,       -- server generated challenge / prize roll
  score integer,
  multiplier numeric(8,3),
  reward_coins bigint not null default 0,
  xp_awarded integer not null default 0,
  result jsonb,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  finished_at timestamptz
);

create index if not exists idx_mgs_user on public.mini_game_sessions (user_id, started_at desc);
create index if not exists idx_mgs_game on public.mini_game_sessions (game_id, started_at desc);
create index if not exists idx_mgs_active on public.mini_game_sessions (status, expires_at);
create index if not exists idx_mgs_finished on public.mini_game_sessions (finished_at desc) where status = 'finished';

grant select on public.mini_game_sessions to authenticated;
grant all on public.mini_game_sessions to service_role;
alter table public.mini_game_sessions enable row level security;

drop policy if exists "mgs own read" on public.mini_game_sessions;
create policy "mgs own read" on public.mini_game_sessions
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- =====================================================================
-- PER-USER STATS
-- =====================================================================
create table if not exists public.mini_game_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.mini_games(id) on delete cascade,
  plays integer not null default 0,
  wins integer not null default 0,
  best_score integer not null default 0,
  total_score bigint not null default 0,
  coins_spent bigint not null default 0,
  coins_won bigint not null default 0,
  xp_earned bigint not null default 0,
  streak_days integer not null default 0,
  last_play_date date,
  last_played_at timestamptz,
  primary key (user_id, game_id)
);

create index if not exists idx_mg_stats_game_best on public.mini_game_stats (game_id, best_score desc);
create index if not exists idx_mg_stats_user on public.mini_game_stats (user_id);

grant select on public.mini_game_stats to authenticated;
grant all on public.mini_game_stats to service_role;
alter table public.mini_game_stats enable row level security;

drop policy if exists "mg stats read" on public.mini_game_stats;
create policy "mg stats read" on public.mini_game_stats
  for select to authenticated using (true);

-- =====================================================================
-- ANTI-CHEAT / AUDIT LOG
-- =====================================================================
create table if not exists public.mini_game_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  session_id uuid,
  slug text,
  reason text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_mg_flags_user on public.mini_game_flags (user_id, created_at desc);
create index if not exists idx_mg_flags_created on public.mini_game_flags (created_at desc);

grant all on public.mini_game_flags to service_role;
alter table public.mini_game_flags enable row level security;
drop policy if exists "mg flags admin" on public.mini_game_flags;
create policy "mg flags admin" on public.mini_game_flags
  for select to authenticated using (public.is_admin(auth.uid()));

-- =====================================================================
-- HELPERS
-- =====================================================================
create or replace function public._mg_secure_rand()
returns numeric language sql volatile as $$
  select (get_byte(gen_random_bytes(4),0)::numeric * 16777216
        + get_byte(gen_random_bytes(4),1)::numeric * 65536
        + get_byte(gen_random_bytes(4),2)::numeric * 256
        + get_byte(gen_random_bytes(4),3)::numeric) / 4294967296.0;
$$;

create or replace function public._mg_flag(_user uuid, _session uuid, _slug text, _reason text, _detail jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.mini_game_flags (user_id, session_id, slug, reason, detail)
  values (_user, _session, _slug, _reason, coalesce(_detail, '{}'::jsonb));
end $$;

-- =====================================================================
-- START SESSION  (atomic entry-fee debit)
-- =====================================================================
create or replace function public.mg_start_session(p_slug text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  g public.mini_games%rowtype;
  bal bigint;
  plays_today int;
  last_at timestamptz;
  sess public.mini_game_sessions%rowtype;
  roll numeric;
  cum numeric := 0;
  total_w numeric := 0;
  prize jsonb;
  chosen jsonb := null;
  challenge jsonb := '{}'::jsonb;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select * into g from public.mini_games where slug = p_slug;
  if not found then raise exception 'game not found'; end if;
  if not g.enabled then raise exception 'This game is currently disabled'; end if;
  if g.maintenance then raise exception 'This game is under maintenance'; end if;

  -- daily limit
  if g.daily_limit > 0 then
    select count(*) into plays_today from public.mini_game_sessions
      where user_id = me and game_id = g.id and started_at >= date_trunc('day', now());
    if plays_today >= g.daily_limit then
      raise exception 'Daily limit reached (% plays)', g.daily_limit;
    end if;
  end if;

  -- cooldown
  if g.cooldown_seconds > 0 then
    select max(started_at) into last_at from public.mini_game_sessions
      where user_id = me and game_id = g.id;
    if last_at is not null and last_at + make_interval(secs => g.cooldown_seconds) > now() then
      raise exception 'COOLDOWN:%', extract(epoch from (last_at + make_interval(secs => g.cooldown_seconds) - now()))::int;
    end if;
  end if;

  -- expire stale sessions, block parallel play (anti duplicate-request)
  update public.mini_game_sessions set status = 'expired'
    where user_id = me and status = 'active' and expires_at < now();

  if exists (select 1 from public.mini_game_sessions
              where user_id = me and game_id = g.id and status = 'active') then
    -- return the existing live session instead of double-charging
    select * into sess from public.mini_game_sessions
      where user_id = me and game_id = g.id and status = 'active'
      order by started_at desc limit 1;
    return jsonb_build_object(
      'session_id', sess.id, 'slug', g.slug, 'entry_cost', sess.entry_cost,
      'payload', sess.payload, 'resumed', true,
      'balance', (select coins from public.profiles where id = me));
  end if;

  -- atomic debit with balance guard
  if g.entry_cost > 0 then
    update public.profiles
       set coins = coins - g.entry_cost
     where id = me and coins >= g.entry_cost
     returning coins into bal;
    if not found then raise exception 'Not enough coins (need %)', g.entry_cost; end if;
  else
    select coins into bal from public.profiles where id = me;
  end if;

  -- server-side randomness for chance games (never trusted to client)
  if coalesce(g.config->>'mode','score') = 'weighted' then
    select coalesce(sum((p->>'weight')::numeric), 0) into total_w
      from jsonb_array_elements(coalesce(g.config->'prizes','[]'::jsonb)) p;
    if total_w <= 0 then raise exception 'no prizes configured'; end if;
    roll := public._mg_secure_rand() * total_w;
    for prize in select p from jsonb_array_elements(g.config->'prizes') p loop
      cum := cum + (prize->>'weight')::numeric;
      if roll < cum then chosen := prize; exit; end if;
    end loop;
    if chosen is null then
      select p into chosen from jsonb_array_elements(g.config->'prizes') p limit 1;
    end if;
    challenge := jsonb_build_object('prize_index',
      (select ord - 1 from jsonb_array_elements(g.config->'prizes') with ordinality t(p, ord)
        where t.p = chosen limit 1));
  end if;

  insert into public.mini_game_sessions (user_id, game_id, slug, entry_cost, payload)
  values (me, g.id, g.slug, g.entry_cost, challenge)
  returning * into sess;

  if g.entry_cost > 0 then
    insert into public.wallet_transactions (user_id, kind, coins_delta, note, ref_type, ref_id, balance_coins_after)
    values (me, 'game_entry', -g.entry_cost, g.name || ' entry', 'mini_game_session', sess.id, bal);

    insert into public.mini_game_stats as s (user_id, game_id, coins_spent)
      values (me, g.id, g.entry_cost)
    on conflict (user_id, game_id) do update set coins_spent = s.coins_spent + excluded.coins_spent;
  end if;

  return jsonb_build_object(
    'session_id', sess.id, 'slug', g.slug, 'entry_cost', g.entry_cost,
    'payload', sess.payload, 'resumed', false, 'balance', bal);
end $$;

grant execute on function public.mg_start_session(text) to authenticated;

-- =====================================================================
-- FINISH SESSION (server computes the ONLY reward that exists)
-- =====================================================================
create or replace function public.mg_finish_session(p_session uuid, p_score integer default 0, p_meta jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  sess public.mini_game_sessions%rowtype;
  g public.mini_games%rowtype;
  mult numeric := 0;
  reward bigint := 0;
  xp int := 0;
  score int := greatest(0, coalesce(p_score, 0));
  dur_ms bigint;
  tier jsonb;
  prizes jsonb;
  prize jsonb;
  label text := null;
  bal bigint;
  today date := (now() at time zone 'utc')::date;
  st public.mini_game_stats%rowtype;
  new_streak int := 1;
  win boolean := false;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select * into sess from public.mini_game_sessions where id = p_session for update;
  if not found then raise exception 'session not found'; end if;
  if sess.user_id <> me then
    perform public._mg_flag(me, p_session, sess.slug, 'session_hijack', jsonb_build_object('owner', sess.user_id));
    raise exception 'not your session';
  end if;

  -- Idempotent: replays return the stored, already-paid result. No double reward, ever.
  if sess.status <> 'active' then
    return coalesce(sess.result, jsonb_build_object('reward_coins', sess.reward_coins, 'replay', true));
  end if;

  select * into g from public.mini_games where id = sess.game_id;
  dur_ms := (extract(epoch from (now() - sess.started_at)) * 1000)::bigint;

  -- ---------- anti-cheat ----------
  if dur_ms < g.min_duration_ms then
    perform public._mg_flag(me, sess.id, g.slug, 'too_fast', jsonb_build_object('duration_ms', dur_ms, 'min', g.min_duration_ms, 'score', score));
    score := 0;
  end if;
  if score > g.max_score then
    perform public._mg_flag(me, sess.id, g.slug, 'impossible_score', jsonb_build_object('score', score, 'max', g.max_score));
    score := 0;
  end if;
  if sess.expires_at < now() then
    perform public._mg_flag(me, sess.id, g.slug, 'expired_submit', jsonb_build_object('duration_ms', dur_ms));
    score := 0;
  end if;
  if (select count(*) from public.mini_game_sessions
        where user_id = me and started_at > now() - interval '1 minute') > 30 then
    perform public._mg_flag(me, sess.id, g.slug, 'rate_abuse', jsonb_build_object('window', '1m'));
    score := 0;
  end if;

  -- ---------- reward ----------
  if coalesce(g.config->>'mode','score') = 'weighted' then
    prizes := coalesce(g.config->'prizes','[]'::jsonb);
    prize := prizes -> coalesce((sess.payload->>'prize_index')::int, 0);
    mult := coalesce((prize->>'mult')::numeric, 0);
    label := prize->>'label';
    reward := coalesce((prize->>'coins')::bigint, floor(greatest(g.reward_base, g.entry_cost) * mult)::bigint);
  else
    for tier in select t from jsonb_array_elements(coalesce(g.config->'tiers','[]'::jsonb)) t
                order by ((t->>'min')::numeric) asc loop
      if score >= (tier->>'min')::int then
        mult := (tier->>'mult')::numeric;
        label := tier->>'label';
      end if;
    end loop;
    reward := floor(greatest(g.reward_base, g.entry_cost) * mult)::bigint;
  end if;

  reward := greatest(0, reward);
  win := reward > sess.entry_cost;
  xp := case when score > 0 then g.xp_reward else 0 end;

  if reward > 0 then
    update public.profiles set coins = coins + reward, xp = xp + xp_reward_safe
      from (select g.xp_reward as xp_reward_safe) q
     where id = me
     returning coins into bal;
  else
    select coins into bal from public.profiles where id = me;
  end if;
  if xp > 0 and reward = 0 then
    update public.profiles set xp = xp + xp where id = me;
  end if;

  update public.mini_game_sessions
     set status = 'finished', score = score, multiplier = mult, reward_coins = reward,
         xp_awarded = xp, finished_at = now(),
         result = jsonb_build_object(
           'session_id', sess.id, 'slug', g.slug, 'score', score,
           'multiplier', mult, 'label', label, 'reward_coins', reward,
           'entry_cost', sess.entry_cost, 'xp', xp, 'win', win, 'balance', bal)
   where id = sess.id
   returning * into sess;

  if reward > 0 then
    insert into public.wallet_transactions (user_id, kind, coins_delta, note, ref_type, ref_id, balance_coins_after)
    values (me, 'game_reward', reward, g.name || ' reward', 'mini_game_session', sess.id, bal);
  end if;

  -- stats + daily streak
  select * into st from public.mini_game_stats where user_id = me and game_id = g.id;
  if st.last_play_date is null then new_streak := 1;
  elsif st.last_play_date = today then new_streak := greatest(1, st.streak_days);
  elsif st.last_play_date = today - 1 then new_streak := st.streak_days + 1;
  else new_streak := 1; end if;

  insert into public.mini_game_stats as s
    (user_id, game_id, plays, wins, best_score, total_score, coins_won, xp_earned, streak_days, last_play_date, last_played_at)
  values (me, g.id, 1, case when win then 1 else 0 end, score, score, reward, xp, new_streak, today, now())
  on conflict (user_id, game_id) do update set
    plays = s.plays + 1,
    wins = s.wins + case when win then 1 else 0 end,
    best_score = greatest(s.best_score, excluded.best_score),
    total_score = s.total_score + excluded.total_score,
    coins_won = s.coins_won + excluded.coins_won,
    xp_earned = s.xp_earned + excluded.xp_earned,
    streak_days = new_streak,
    last_play_date = today,
    last_played_at = now();

  return sess.result;
end $$;

grant execute on function public.mg_finish_session(uuid, integer, jsonb) to authenticated;

-- =====================================================================
-- LEADERBOARD
-- =====================================================================
create or replace function public.mg_leaderboard(p_period text default 'all', p_slug text default null, p_limit int default 50)
returns table (
  user_id uuid, username text, avatar text, frame text,
  score bigint, coins_won bigint, plays bigint
)
language sql stable security definer set search_path = public as $$
  with since as (
    select case p_period
      when 'daily' then date_trunc('day', now())
      when 'weekly' then date_trunc('week', now())
      when 'monthly' then date_trunc('month', now())
      else '-infinity'::timestamptz end as ts
  )
  select s.user_id,
         p.username,
         p.avatar,
         p.frame,
         coalesce(max(s.score), 0)::bigint as score,
         coalesce(sum(s.reward_coins), 0)::bigint as coins_won,
         count(*)::bigint as plays
    from public.mini_game_sessions s
    join public.profiles p on p.id = s.user_id
   cross join since
   where s.status = 'finished'
     and s.finished_at >= since.ts
     and (p_slug is null or s.slug = p_slug)
   group by s.user_id, p.username, p.avatar, p.frame
   order by coins_won desc, score desc
   limit greatest(1, least(p_limit, 200));
$$;

grant execute on function public.mg_leaderboard(text, text, int) to authenticated, anon;

-- =====================================================================
-- PROFILE SUMMARY
-- =====================================================================
create or replace function public.mg_profile_summary(p_user uuid default null)
returns jsonb
language sql stable security definer set search_path = public as $$
  with u as (select coalesce(p_user, auth.uid()) as uid),
  agg as (
    select coalesce(sum(plays),0)::bigint plays,
           coalesce(sum(wins),0)::bigint wins,
           coalesce(sum(coins_spent),0)::bigint spent,
           coalesce(sum(coins_won),0)::bigint won,
           coalesce(sum(xp_earned),0)::bigint xp,
           coalesce(max(streak_days),0)::int streak
      from public.mini_game_stats, u where user_id = u.uid
  ),
  best as (
    select jsonb_agg(jsonb_build_object(
      'slug', g.slug, 'name', g.name, 'icon', g.icon,
      'best_score', s.best_score, 'plays', s.plays, 'wins', s.wins,
      'coins_won', s.coins_won) order by s.plays desc) as rows
    from public.mini_game_stats s join public.mini_games g on g.id = s.game_id, u
    where s.user_id = u.uid
  ),
  recent as (
    select jsonb_agg(jsonb_build_object(
      'slug', s.slug, 'score', s.score, 'reward', s.reward_coins,
      'entry', s.entry_cost, 'at', s.finished_at) order by s.finished_at desc) as rows
    from (select * from public.mini_game_sessions, u
          where user_id = u.uid and status='finished'
          order by finished_at desc limit 20) s
  )
  select jsonb_build_object(
    'plays', agg.plays, 'wins', agg.wins, 'coins_spent', agg.spent,
    'coins_won', agg.won, 'xp', agg.xp, 'streak', agg.streak,
    'games', coalesce(best.rows, '[]'::jsonb),
    'history', coalesce(recent.rows, '[]'::jsonb))
  from agg, best, recent;
$$;

grant execute on function public.mg_profile_summary(uuid) to authenticated;

-- =====================================================================
-- ADMIN STATS
-- =====================================================================
create or replace function public.mg_admin_stats()
returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.is_admin(auth.uid()) then '{}'::jsonb else
    jsonb_build_object(
      'per_game', coalesce((
        select jsonb_agg(jsonb_build_object(
          'slug', g.slug, 'name', g.name,
          'plays', coalesce(x.plays,0), 'players', coalesce(x.players,0),
          'coins_in', coalesce(x.coins_in,0), 'coins_out', coalesce(x.coins_out,0),
          'plays_today', coalesce(x.today,0)) order by g.sort_order)
        from public.mini_games g
        left join (
          select game_id,
                 count(*) filter (where status='finished') plays,
                 count(distinct user_id) players,
                 sum(entry_cost) coins_in,
                 sum(reward_coins) coins_out,
                 count(*) filter (where started_at >= date_trunc('day', now())) today
            from public.mini_game_sessions group by game_id
        ) x on x.game_id = g.id
      ), '[]'::jsonb),
      'active_sessions', (select count(*) from public.mini_game_sessions where status='active' and expires_at > now()),
      'players_24h', (select count(distinct user_id) from public.mini_game_sessions where started_at > now() - interval '24 hours'),
      'coins_in_24h', (select coalesce(sum(entry_cost),0) from public.mini_game_sessions where started_at > now() - interval '24 hours'),
      'coins_out_24h', (select coalesce(sum(reward_coins),0) from public.mini_game_sessions where finished_at > now() - interval '24 hours'),
      'flags_24h', (select count(*) from public.mini_game_flags where created_at > now() - interval '24 hours')
    ) end;
$$;

grant execute on function public.mg_admin_stats() to authenticated;

commit;
