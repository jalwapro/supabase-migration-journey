-- 0308_casino_games.sql — Jalwa Casino mini games (Dragon vs Tiger, In & Out,
-- Crash X, Plinko). 777 Slots keeps its own engine (0307_slots.sql).
--
-- Everything is server-authoritative: the client sends a bet + choice and
-- renders whatever casino_play() returns. RNG, coin debit, payout, history
-- and stats all happen atomically inside one transaction. Virtual Jalwa
-- coins only (profiles.coins) — no real money anywhere.
begin;

-- ---------------------------------------------------------------------------
-- Per-game admin configuration
-- ---------------------------------------------------------------------------
create table if not exists public.casino_games (
  slug text primary key,
  name text not null,
  icon text not null default '🎮',
  enabled boolean not null default true,
  maintenance boolean not null default false,
  min_bet bigint not null default 10,
  max_bet bigint not null default 50000,
  rtp_bp integer not null default 9700 check (rtp_bp between 5000 and 10000),
  jackpot bigint not null default 0,
  announcement text,
  sort_order integer not null default 100,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.casino_bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid,
  game text not null references public.casino_games(slug),
  bet bigint not null,
  payout bigint not null default 0,
  params jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_casino_bets_user on public.casino_bets (user_id, created_at desc);
create index if not exists idx_casino_bets_game on public.casino_bets (game, created_at desc);
create index if not exists idx_casino_bets_recent on public.casino_bets (created_at desc);

grant select on public.casino_games to anon, authenticated;
grant update on public.casino_games to authenticated;
grant select on public.casino_bets to authenticated;
grant all on public.casino_games, public.casino_bets to service_role;

alter table public.casino_games enable row level security;
alter table public.casino_bets enable row level security;

drop policy if exists "casino_games read" on public.casino_games;
create policy "casino_games read" on public.casino_games for select using (true);

drop policy if exists "casino_games admin" on public.casino_games;
create policy "casino_games admin" on public.casino_games
  for update to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "casino_bets read" on public.casino_bets;
create policy "casino_bets read" on public.casino_bets for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

insert into public.casino_games (slug, name, icon, min_bet, max_bet, rtp_bp, sort_order, config) values
  ('dragon_tiger', 'Dragon vs Tiger', '🐉', 10, 50000, 9700, 20, '{}'::jsonb),
  ('in_out', 'In & Out', '🔴', 10, 50000, 9700, 30, '{"in_low":4,"in_high":7}'::jsonb),
  ('crash', 'Crash X', '🚀', 10, 50000, 9700, 40, '{"max_multiplier":100}'::jsonb),
  ('plinko', 'Plinko', '🟣', 10, 50000, 9700, 50,
    '{"rows":12,
      "low":   [5,2.1,1.4,1.1,1,0.7,0.5,0.7,1,1.1,1.4,2.1,5],
      "medium":[22,6,3,1.4,0.9,0.5,0.3,0.5,0.9,1.4,3,6,22],
      "high":  [100,25,8,2,0.7,0.3,0.2,0.3,0.7,2,8,25,100]}'::jsonb)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- casino_play — the single entry point for all four games
-- ---------------------------------------------------------------------------
create or replace function public.casino_play(
  p_game text,
  p_bet bigint,
  p_params jsonb default '{}'::jsonb,
  p_room_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  g public.casino_games%rowtype;
  rtp numeric;
  bal bigint;
  payout bigint := 0;
  mult numeric := 0;
  res jsonb := '{}'::jsonb;
  recent int;
  -- dragon tiger
  dcard int; tcard int; pick text; winner text; odds numeric;
  -- in & out
  ball int; in_low int; in_high int; p_in numeric;
  -- crash
  u numeric; crash_at numeric; target numeric;
  -- plinko
  rows_n int; rights int; i int; path boolean[]; risk text; table_j jsonb;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select * into g from public.casino_games where slug = p_game;
  if not found then raise exception 'Unknown game'; end if;
  if not g.enabled then raise exception 'This game is currently disabled'; end if;
  if g.maintenance then raise exception 'This game is under maintenance'; end if;
  if p_bet < g.min_bet or p_bet > g.max_bet then
    raise exception 'Bet must be between % and %', g.min_bet, g.max_bet;
  end if;

  select count(*) into recent from public.casino_bets
    where user_id = me and created_at > now() - interval '1 minute';
  if recent > 120 then raise exception 'Too many rounds, slow down'; end if;

  rtp := g.rtp_bp / 10000.0;

  -- debit the stake first (atomic balance guard)
  update public.profiles set coins = coins - p_bet where id = me and coins >= p_bet;
  if not found then raise exception 'Not enough coins'; end if;

  if p_game = 'dragon_tiger' then
    pick := coalesce(p_params->>'pick', 'dragon');
    if pick not in ('dragon','tiger','tie') then raise exception 'Invalid pick'; end if;
    dcard := 1 + floor(random() * 13)::int;
    tcard := 1 + floor(random() * 13)::int;
    winner := case when dcard > tcard then 'dragon' when tcard > dcard then 'tiger' else 'tie' end;
    -- fair odds scaled by RTP: side prob = 6/13, tie prob = 1/13
    odds := case when pick = 'tie' then rtp * 13 else rtp * 13.0 / 6.0 end;
    if winner = pick then mult := odds; end if;
    res := jsonb_build_object('dragon_card', dcard, 'tiger_card', tcard, 'winner', winner, 'odds', round(odds, 2));

  elsif p_game = 'in_out' then
    pick := coalesce(p_params->>'pick', 'in');
    if pick not in ('in','out') then raise exception 'Invalid pick'; end if;
    in_low := coalesce((g.config->>'in_low')::int, 4);
    in_high := coalesce((g.config->>'in_high')::int, 7);
    ball := 1 + floor(random() * 10)::int;
    winner := case when ball between in_low and in_high then 'in' else 'out' end;
    p_in := (in_high - in_low + 1) / 10.0;
    odds := case when pick = 'in' then rtp / p_in else rtp / (1 - p_in) end;
    if winner = pick then mult := odds; end if;
    res := jsonb_build_object('ball', ball, 'winner', winner, 'odds', round(odds, 2),
                              'in_low', in_low, 'in_high', in_high);

  elsif p_game = 'crash' then
    target := coalesce((p_params->>'auto_cashout')::numeric, 2);
    if target < 1.01 or target > coalesce((g.config->>'max_multiplier')::numeric, 100) then
      raise exception 'Cash-out target out of range';
    end if;
    u := random();
    crash_at := greatest(1.00, floor(100 * rtp / greatest(1 - u, 0.0001)) / 100.0);
    crash_at := least(crash_at, coalesce((g.config->>'max_multiplier')::numeric, 100));
    if target <= crash_at then mult := target; end if;
    res := jsonb_build_object('crash_at', round(crash_at, 2), 'target', round(target, 2),
                              'cashed_out', target <= crash_at);

  elsif p_game = 'plinko' then
    risk := coalesce(p_params->>'risk', 'medium');
    if risk not in ('low','medium','high') then raise exception 'Invalid risk'; end if;
    table_j := g.config->risk;
    rows_n := coalesce((g.config->>'rows')::int, 12);
    rights := 0;
    path := array[]::boolean[];
    for i in 1..rows_n loop
      if random() < 0.5 then
        path := path || true; rights := rights + 1;
      else
        path := path || false;
      end if;
    end loop;
    mult := coalesce((table_j->rights)::numeric, 0) * rtp;
    res := jsonb_build_object('path', to_jsonb(path), 'bucket', rights,
                              'multipliers', table_j, 'risk', risk, 'rows', rows_n);

  else
    raise exception 'Unsupported game';
  end if;

  payout := floor(p_bet * mult)::bigint;
  if payout > 0 then
    update public.profiles set coins = coins + payout where id = me;
  end if;

  select coins into bal from public.profiles where id = me;

  insert into public.casino_bets (user_id, room_id, game, bet, payout, params, result)
    values (me, p_room_id, p_game, p_bet, payout, coalesce(p_params, '{}'::jsonb), res);

  return res || jsonb_build_object(
    'game', p_game, 'bet', p_bet, 'payout', payout,
    'multiplier', round(mult, 2), 'won', payout > 0, 'balance', bal
  );
end;
$$;

grant execute on function public.casino_play(text, bigint, jsonb, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Public feeds: recent winners, my history, leaderboard, admin stats
-- ---------------------------------------------------------------------------
create or replace function public.casino_recent(p_game text, p_limit int default 12)
returns table (username text, avatar_url text, bet bigint, payout bigint, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select coalesce(pr.username, 'Player'), pr.avatar_url, b.bet, b.payout, b.created_at
  from public.casino_bets b
  join public.profiles pr on pr.id = b.user_id
  where b.game = p_game and b.payout > 0
  order by b.created_at desc
  limit least(coalesce(p_limit, 12), 50);
$$;

create or replace function public.casino_leaderboard(p_game text default null, p_days int default 7, p_limit int default 20)
returns table (user_id uuid, username text, avatar_url text, total_bet bigint, total_won bigint, net bigint, rounds bigint)
language sql stable security definer set search_path = public as $$
  select b.user_id, coalesce(pr.username, 'Player'), pr.avatar_url,
         sum(b.bet)::bigint, sum(b.payout)::bigint, (sum(b.payout) - sum(b.bet))::bigint, count(*)::bigint
  from public.casino_bets b
  join public.profiles pr on pr.id = b.user_id
  where b.created_at > now() - (coalesce(p_days, 7) || ' days')::interval
    and (p_game is null or b.game = p_game)
  group by b.user_id, pr.username, pr.avatar_url
  order by 6 desc
  limit least(coalesce(p_limit, 20), 100);
$$;

create or replace function public.casino_admin_stats(p_days int default 7)
returns table (game text, rounds bigint, players bigint, total_bet bigint, total_won bigint, revenue bigint)
language sql stable security definer set search_path = public as $$
  select b.game, count(*)::bigint, count(distinct b.user_id)::bigint,
         sum(b.bet)::bigint, sum(b.payout)::bigint, (sum(b.bet) - sum(b.payout))::bigint
  from public.casino_bets b
  where b.created_at > now() - (coalesce(p_days, 7) || ' days')::interval
    and public.is_admin(auth.uid())
  group by b.game
  order by 4 desc;
$$;

grant execute on function public.casino_recent(text, int) to authenticated;
grant execute on function public.casino_leaderboard(text, int, int) to authenticated;
grant execute on function public.casino_admin_stats(int) to authenticated;

notify pgrst, 'reload schema';
commit;
