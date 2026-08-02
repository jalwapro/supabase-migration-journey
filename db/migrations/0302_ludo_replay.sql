-- 0302: Ludo match replay + server-validation debug log.
-- Every turn, dice roll and move is recorded server-side so players can replay
-- their own matches and admins can debug any match end-to-end.

create table if not exists public.ludo_matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.live_rooms(id) on delete set null,
  bet_coins integer not null default 0,
  status text not null default 'active' check (status in ('active','finished','aborted')),
  player_ids uuid[] not null default '{}',
  winner_id uuid references public.profiles(id) on delete set null,
  turn_count integer not null default 0,
  seed text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.ludo_match_events (
  id bigserial primary key,
  match_id uuid not null references public.ludo_matches(id) on delete cascade,
  seq integer not null,
  actor_id uuid references public.profiles(id) on delete set null,
  turn_no integer not null default 0,
  kind text not null check (kind in ('start','roll','move','skip','capture','home','win','abort','error')),
  dice int,
  from_pos int,
  to_pos int,
  token_index int,
  -- server validation trace
  valid boolean not null default true,
  rejection text,
  server_ms integer,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (match_id, seq)
);

grant select on public.ludo_matches to authenticated;
grant select on public.ludo_match_events to authenticated;
grant all on public.ludo_matches to service_role;
grant all on public.ludo_match_events to service_role;
grant usage, select on sequence public.ludo_match_events_id_seq to authenticated, service_role;

alter table public.ludo_matches enable row level security;
alter table public.ludo_match_events enable row level security;

drop policy if exists "ludo matches readable by players and admins" on public.ludo_matches;
create policy "ludo matches readable by players and admins"
on public.ludo_matches for select to authenticated
using (auth.uid() = any (player_ids) or public.is_admin(auth.uid()));

drop policy if exists "ludo events readable by players and admins" on public.ludo_match_events;
create policy "ludo events readable by players and admins"
on public.ludo_match_events for select to authenticated
using (exists (
  select 1 from public.ludo_matches m
  where m.id = match_id
    and (auth.uid() = any (m.player_ids) or public.is_admin(auth.uid()))
));

create index if not exists idx_ludo_matches_players on public.ludo_matches using gin (player_ids);
create index if not exists idx_ludo_matches_created on public.ludo_matches (created_at desc);
create index if not exists idx_ludo_matches_room on public.ludo_matches (room_id);
create index if not exists idx_ludo_events_match on public.ludo_match_events (match_id, seq);

-- ---------------------------------------------------------------- write RPCs
-- Matches and events are only ever written through security-definer functions
-- so a client can never forge a dice value or a validation verdict.

create or replace function public.ludo_open_match(p_room uuid, p_players uuid[], p_bet integer default 0)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not (auth.uid() = any (p_players)) then raise exception 'NOT_A_PLAYER'; end if;

  insert into public.ludo_matches (room_id, player_ids, bet_coins, seed)
  values (p_room, p_players, greatest(0, coalesce(p_bet, 0)), encode(gen_random_bytes(8), 'hex'))
  returning id into v_id;

  insert into public.ludo_match_events (match_id, seq, actor_id, kind, payload)
  values (v_id, 1, auth.uid(), 'start', jsonb_build_object('players', p_players, 'bet', p_bet));

  return v_id;
end $$;

-- Server rolls the dice. The client never supplies the value.
create or replace function public.ludo_roll(p_match uuid, p_turn integer)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_m public.ludo_matches; v_seq int; v_dice int; v_t0 timestamptz := clock_timestamp();
begin
  select * into v_m from public.ludo_matches where id = p_match;
  if v_m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  if v_m.status <> 'active' then raise exception 'MATCH_CLOSED'; end if;
  if not (auth.uid() = any (v_m.player_ids)) then raise exception 'NOT_A_PLAYER'; end if;

  v_dice := 1 + floor(random() * 6)::int;
  select coalesce(max(seq), 0) + 1 into v_seq from public.ludo_match_events where match_id = p_match;

  insert into public.ludo_match_events (match_id, seq, actor_id, turn_no, kind, dice, valid, server_ms)
  values (p_match, v_seq, auth.uid(), coalesce(p_turn, 0), 'roll', v_dice, true,
          (extract(milliseconds from clock_timestamp() - v_t0))::int);

  update public.ludo_matches set turn_count = greatest(turn_count, coalesce(p_turn, 0)) where id = p_match;
  return jsonb_build_object('seq', v_seq, 'dice', v_dice);
end $$;

-- Records a move together with the server's verdict on whether it was legal.
create or replace function public.ludo_record_move(
  p_match uuid, p_turn integer, p_token integer, p_from integer, p_to integer,
  p_kind text default 'move', p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_m public.ludo_matches; v_seq int; v_dice int; v_valid boolean := true; v_reason text;
begin
  select * into v_m from public.ludo_matches where id = p_match;
  if v_m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  if v_m.status <> 'active' then raise exception 'MATCH_CLOSED'; end if;
  if not (auth.uid() = any (v_m.player_ids)) then raise exception 'NOT_A_PLAYER'; end if;

  -- verdict: the move must match the dice this player last rolled
  select dice into v_dice from public.ludo_match_events
   where match_id = p_match and actor_id = auth.uid() and kind = 'roll'
   order by seq desc limit 1;

  if v_dice is null then
    v_valid := false; v_reason := 'NO_DICE_FOR_TURN';
  elsif p_from is not null and p_to is not null and p_from >= 0 and (p_to - p_from) <> v_dice then
    v_valid := false; v_reason := format('MOVE_DISTANCE_MISMATCH(dice=%s, delta=%s)', v_dice, p_to - p_from);
  elsif p_from = -1 and v_dice <> 6 then
    v_valid := false; v_reason := 'CANNOT_LEAVE_BASE_WITHOUT_SIX';
  elsif p_token < 0 or p_token > 3 then
    v_valid := false; v_reason := 'TOKEN_OUT_OF_RANGE';
  end if;

  select coalesce(max(seq), 0) + 1 into v_seq from public.ludo_match_events where match_id = p_match;

  insert into public.ludo_match_events
    (match_id, seq, actor_id, turn_no, kind, dice, from_pos, to_pos, token_index, valid, rejection, payload)
  values (p_match, v_seq, auth.uid(), coalesce(p_turn, 0),
          case when v_valid then coalesce(p_kind, 'move') else 'error' end,
          v_dice, p_from, p_to, p_token, v_valid, v_reason, coalesce(p_payload, '{}'::jsonb));

  return jsonb_build_object('seq', v_seq, 'valid', v_valid, 'rejection', v_reason);
end $$;

create or replace function public.ludo_close_match(p_match uuid, p_winner uuid default null, p_status text default 'finished')
returns void
language plpgsql security definer set search_path = public as $$
declare v_m public.ludo_matches; v_seq int;
begin
  select * into v_m from public.ludo_matches where id = p_match;
  if v_m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  if not (auth.uid() = any (v_m.player_ids) or public.is_admin(auth.uid())) then
    raise exception 'NOT_A_PLAYER';
  end if;

  select coalesce(max(seq), 0) + 1 into v_seq from public.ludo_match_events where match_id = p_match;
  insert into public.ludo_match_events (match_id, seq, actor_id, kind, payload)
  values (p_match, v_seq, p_winner, case when p_status = 'finished' then 'win' else 'abort' end,
          jsonb_build_object('winner', p_winner));

  update public.ludo_matches
     set status = case when p_status in ('finished','aborted') then p_status else 'finished' end,
         winner_id = p_winner, finished_at = now()
   where id = p_match;
end $$;

-- ----------------------------------------------------------------- read RPCs
create or replace function public.ludo_match_list(p_user uuid default null, p_limit int default 30)
returns table (
  id uuid, room_id uuid, status text, bet_coins integer, winner_id uuid,
  turn_count integer, created_at timestamptz, finished_at timestamptz,
  players jsonb, event_count bigint, invalid_count bigint
)
language sql stable security definer set search_path = public as $$
  with scope as (
    select m.* from public.ludo_matches m
    where (
      -- admins may target any user (or all); everyone else is pinned to self
      case when public.is_admin(auth.uid())
           then (p_user is null or p_user = any (m.player_ids))
           else auth.uid() = any (m.player_ids)
      end
    )
    order by m.created_at desc
    limit greatest(1, least(coalesce(p_limit, 30), 100))
  )
  select s.id, s.room_id, s.status, s.bet_coins, s.winner_id, s.turn_count,
         s.created_at, s.finished_at,
         coalesce((
           select jsonb_agg(jsonb_build_object('id', pr.id, 'username', pr.username, 'avatar', pr.avatar))
           from public.profiles pr where pr.id = any (s.player_ids)
         ), '[]'::jsonb),
         (select count(*) from public.ludo_match_events e where e.match_id = s.id),
         (select count(*) from public.ludo_match_events e where e.match_id = s.id and not e.valid)
  from scope s
  order by s.created_at desc;
$$;

create or replace function public.ludo_match_replay(p_match uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_m public.ludo_matches; v_events jsonb;
begin
  select * into v_m from public.ludo_matches where id = p_match;
  if v_m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  if not (auth.uid() = any (v_m.player_ids) or public.is_admin(auth.uid())) then
    raise exception 'FORBIDDEN';
  end if;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.seq), '[]'::jsonb) into v_events
  from public.ludo_match_events e where e.match_id = p_match;

  return jsonb_build_object(
    'match', to_jsonb(v_m),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object('id', pr.id, 'username', pr.username, 'avatar', pr.avatar))
      from public.profiles pr where pr.id = any (v_m.player_ids)), '[]'::jsonb),
    'events', v_events,
    'is_admin', public.is_admin(auth.uid())
  );
end $$;

grant execute on function public.ludo_open_match(uuid, uuid[], integer) to authenticated;
grant execute on function public.ludo_roll(uuid, integer) to authenticated;
grant execute on function public.ludo_record_move(uuid, integer, integer, integer, integer, text, jsonb) to authenticated;
grant execute on function public.ludo_close_match(uuid, uuid, text) to authenticated;
grant execute on function public.ludo_match_list(uuid, int) to authenticated;
grant execute on function public.ludo_match_replay(uuid) to authenticated;
