-- 0309_casino_games_v2.sql — six more server-authoritative Jalwa casino games:
-- Under & Over 7, Crash Point, Scratch Card, Apple of Fortune, Spin & Win,
-- Vampire Curse. Same engine/table as 0308 (casino_games + casino_bets),
-- same atomic debit/credit, virtual Jalwa coins only.
begin;

insert into public.casino_games (slug, name, icon, min_bet, max_bet, rtp_bp, sort_order, config) values
  ('under_over_7', 'Under & Over 7', '🎲', 10, 50000, 9700, 60, '{}'::jsonb),
  ('crash_point',  'Crash Point',    '💥', 10, 50000, 9700, 70, '{"max_multiplier":100}'::jsonb),
  ('scratch_card', 'Scratch Card',   '🎫', 10, 50000, 9700, 80,
     '{"mults":[0,1,2,5,10,50,500],"weights":[58,18,11,7,4,1.6,0.4],
       "symbols":["🍒","🔔","💰","👑","💎","7️⃣","🧧"]}'::jsonb),
  ('apple_fortune','Apple of Fortune','🍎',10, 50000, 9700, 90, '{"lanes":4,"max_steps":6}'::jsonb),
  ('spin_win',     'Spin & Win',     '🎡', 10, 50000, 9700, 100,
     '{"mults":[0,0.5,1,2,5,10,25,100],"weights":[26,24,20,14,9,5,1.6,0.4]}'::jsonb),
  ('vampire_curse','Vampire Curse',  '🧛', 10, 50000, 9700, 110,
     '{"mults":[0,0,1,2,5,20,100],"weights":[30,22,18,15,10,4,1],
       "labels":["Curse","Curse","Blood","Coin","Crown","Diamond","Jackpot"]}'::jsonb)
on conflict (slug) do nothing;

-- weighted pick: returns a 0-based index into weights
create or replace function public.casino_weighted_pick(p_weights numeric[])
returns int language plpgsql volatile as $$
declare total numeric := 0; r numeric; acc numeric := 0; i int;
begin
  for i in 1..array_length(p_weights, 1) loop total := total + p_weights[i]; end loop;
  r := random() * total;
  for i in 1..array_length(p_weights, 1) loop
    acc := acc + p_weights[i];
    if r <= acc then return i - 1; end if;
  end loop;
  return array_length(p_weights, 1) - 1;
end; $$;

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
  dcard int; tcard int; pick text; winner text; odds numeric;
  ball int; in_low int; in_high int; p_in numeric;
  u numeric; crash_at numeric; target numeric; max_m numeric;
  rows_n int; rights int; i int; j int; path boolean[]; risk text; table_j jsonb;
  d1 int; d2 int; total int;
  mults numeric[]; weights numeric[]; ev numeric; idx int;
  lanes int; steps int; picks jsonb; bad int; alive boolean; rotten int[];
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

  update public.profiles set coins = coins - p_bet where id = me and coins >= p_bet;
  if not found then raise exception 'Not enough coins'; end if;

  if p_game = 'dragon_tiger' then
    pick := coalesce(p_params->>'pick', 'dragon');
    if pick not in ('dragon','tiger','tie') then raise exception 'Invalid pick'; end if;
    dcard := 1 + floor(random() * 13)::int;
    tcard := 1 + floor(random() * 13)::int;
    winner := case when dcard > tcard then 'dragon' when tcard > dcard then 'tiger' else 'tie' end;
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

  elsif p_game in ('crash', 'crash_point') then
    max_m := coalesce((g.config->>'max_multiplier')::numeric, 100);
    target := coalesce((p_params->>'auto_cashout')::numeric, 2);
    if target < 1.01 or target > max_m then raise exception 'Cash-out target out of range'; end if;
    u := random();
    crash_at := greatest(1.00, floor(100 * rtp / greatest(1 - u, 0.0001)) / 100.0);
    crash_at := least(crash_at, max_m);
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
      if random() < 0.5 then path := path || true; rights := rights + 1;
      else path := path || false; end if;
    end loop;
    mult := coalesce((table_j->rights)::numeric, 0) * rtp;
    res := jsonb_build_object('path', to_jsonb(path), 'bucket', rights,
                              'multipliers', table_j, 'risk', risk, 'rows', rows_n);

  elsif p_game = 'under_over_7' then
    pick := coalesce(p_params->>'pick', 'under');
    if pick not in ('under','over','exact') then raise exception 'Invalid pick'; end if;
    d1 := 1 + floor(random() * 6)::int;
    d2 := 1 + floor(random() * 6)::int;
    total := d1 + d2;
    winner := case when total < 7 then 'under' when total > 7 then 'over' else 'exact' end;
    odds := case when pick = 'exact' then rtp * 6 else rtp * 36.0 / 15.0 end;
    if winner = pick then mult := odds; end if;
    res := jsonb_build_object('dice', jsonb_build_array(d1, d2), 'total', total,
                              'winner', winner, 'odds', round(odds, 2));

  elsif p_game in ('scratch_card', 'spin_win', 'vampire_curse') then
    select array(select jsonb_array_elements_text(g.config->'mults')::numeric) into mults;
    select array(select jsonb_array_elements_text(g.config->'weights')::numeric) into weights;
    ev := 0;
    total := 0;
    for i in 1..array_length(weights, 1) loop ev := ev + weights[i] * mults[i]; total := total + weights[i]; end loop;
    ev := ev / total;
    idx := public.casino_weighted_pick(weights);
    mult := case when ev > 0 then mults[idx + 1] * rtp / ev else 0 end;
    res := jsonb_build_object('index', idx, 'raw_multiplier', mults[idx + 1],
                              'multipliers', g.config->'mults');
    if p_game = 'scratch_card' then
      res := res || jsonb_build_object('symbol', coalesce(g.config->'symbols'->idx, to_jsonb('❌'::text)));
    elsif p_game = 'vampire_curse' then
      res := res || jsonb_build_object('label', coalesce(g.config->'labels'->idx, to_jsonb('Curse'::text)),
                                       'chest', coalesce((p_params->>'chest')::int, floor(random() * 6)::int));
    end if;

  elsif p_game = 'apple_fortune' then
    lanes := greatest(2, coalesce((g.config->>'lanes')::int, 4));
    steps := coalesce((p_params->>'steps')::int, 1);
    if steps < 1 or steps > coalesce((g.config->>'max_steps')::int, 6) then
      raise exception 'Invalid number of levels';
    end if;
    picks := coalesce(p_params->'picks', '[]'::jsonb);
    if jsonb_array_length(picks) <> steps then raise exception 'Picks do not match levels'; end if;
    rotten := array[]::int[];
    alive := true;
    bad := 0;
    for i in 1..steps loop
      j := floor(random() * lanes)::int;
      rotten := rotten || j;
      if alive and (picks->>(i - 1))::int = j then alive := false; bad := i; end if;
    end loop;
    if alive then mult := rtp * power(lanes::numeric / (lanes - 1), steps); end if;
    res := jsonb_build_object('rotten', to_jsonb(rotten), 'lanes', lanes, 'steps', steps,
                              'survived', alive, 'failed_at', bad);

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

-- my own history for the in-game History popup
create or replace function public.casino_my_history(p_game text default null, p_limit int default 30)
returns table (id uuid, game text, bet bigint, payout bigint, result jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.id, b.game, b.bet, b.payout, b.result, b.created_at
  from public.casino_bets b
  where b.user_id = auth.uid() and (p_game is null or b.game = p_game)
  order by b.created_at desc
  limit least(coalesce(p_limit, 30), 100);
$$;

grant execute on function public.casino_my_history(text, int) to authenticated;

commit;
