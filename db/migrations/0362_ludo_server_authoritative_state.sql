-- 0362: Server-authoritative Ludo state for wagered matches.
-- The client may render/animate locally, but rolls, moves and the final winner
-- are accepted only through these security-definer RPCs. ludo_close_match
-- derives the winner from server_state instead of trusting p_winner.

alter table public.ludo_matches
  add column if not exists server_state jsonb;

create or replace function public.ludo_open_match(
  p_room uuid,
  p_players uuid[],
  p_bet integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
  v_player uuid;
  v_count integer;
  v_new_balance bigint;
  v_state jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_room is null then raise exception 'ROOM_REQUIRED'; end if;
  if p_bet not in (100, 500, 1000, 5000) then raise exception 'INVALID_BET'; end if;
  if p_players is null or coalesce(array_length(p_players, 1), 0) < 2 then raise exception 'AT_LEAST_TWO_PLAYERS_REQUIRED'; end if;
  if not (v_uid = any(p_players)) then raise exception 'NOT_A_PLAYER'; end if;
  if (select count(*) from unnest(p_players)) <> (select count(distinct x) from unnest(p_players) x) then raise exception 'DUPLICATE_PLAYERS'; end if;

  select count(*) into v_count
  from unnest(p_players) as x
  where exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room and rm.user_id = x and rm.seat_index is not null
  );
  if v_count <> array_length(p_players, 1) then raise exception 'ALL_PLAYERS_MUST_BE_SEATED'; end if;

  v_state := jsonb_build_object(
    'turnIndex', 0,
    'dice', null,
    'consecutiveSixes', 0,
    'awaitingMove', false,
    'winnerIndex', null,
    'winnerId', null,
    'players', (
      select jsonb_agg(jsonb_build_object('userId', x, 'tokens', jsonb_build_array(0,0,0,0)) order by ord)
      from unnest(p_players) with ordinality as u(x, ord)
    )
  );

  insert into public.ludo_matches(room_id, player_ids, bet_coins, seed, server_state)
  values (p_room, p_players, p_bet, encode(gen_random_bytes(8), 'hex'), v_state)
  returning id into v_id;

  foreach v_player in array p_players loop
    update public.profiles
       set coins = coins - p_bet, updated_at = now()
     where id = v_player and coins >= p_bet
     returning coins into v_new_balance;
    if not found then raise exception 'PLAYER_NOT_ENOUGH_COINS:%', v_player; end if;
    insert into public.wallet_transactions
      (user_id, kind, coins_delta, balance_coins_after, ref_type, ref_id, note)
    values
      (v_player, 'ludo_bet', -p_bet, v_new_balance, 'ludo_match', v_id, 'Ludo match entry bet');
  end loop;

  insert into public.ludo_match_events(match_id, seq, actor_id, kind, payload)
  values (v_id, 1, v_uid, 'start', jsonb_build_object('players', p_players, 'bet', p_bet));
  return v_id;
end;
$$;

create or replace function public.ludo_server_roll(p_match uuid, p_turn integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m public.ludo_matches;
  v_state jsonb;
  v_idx integer;
  v_actor uuid;
  v_dice integer;
  v_consecutive integer;
  v_valid boolean := false;
  v_tokens jsonb;
  v_token integer;
  v_next integer;
  v_seq integer;
begin
  select * into v_m from public.ludo_matches where id = p_match for update;
  if v_m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  if v_m.status <> 'active' then raise exception 'MATCH_CLOSED'; end if;
  if v_m.server_state is null then raise exception 'SERVER_STATE_MISSING'; end if;

  v_state := v_m.server_state;
  v_idx := coalesce((v_state->>'turnIndex')::integer, 0);
  if p_turn <> v_idx then raise exception 'STALE_TURN'; end if;
  v_actor := (v_m.player_ids)[v_idx + 1];
  if auth.uid() <> v_actor then raise exception 'NOT_CURRENT_PLAYER'; end if;
  if coalesce((v_state->>'awaitingMove')::boolean, false) then raise exception 'MOVE_REQUIRED'; end if;

  v_dice := 1 + floor(random() * 6)::integer;
  v_consecutive := case when v_dice = 6 then coalesce((v_state->>'consecutiveSixes')::integer, 0) + 1 else 0 end;
  v_tokens := (v_state->'players'->v_idx->'tokens');
  for v_token in 0..3 loop
    if ((v_tokens->v_token)::integer = 0 and v_dice = 6)
       or ((v_tokens->v_token)::integer > 0 and (v_tokens->v_token)::integer < 58 and (v_tokens->v_token)::integer + v_dice <= 58) then
      v_valid := true;
      exit;
    end if;
  end loop;

  if v_dice = 6 and v_consecutive >= 3 then
    v_next := (v_idx + 1) % array_length(v_m.player_ids, 1);
    v_state := jsonb_set(v_state, '{turnIndex}', to_jsonb(v_next), true);
    v_state := jsonb_set(v_state, '{consecutiveSixes}', '0'::jsonb, true);
    v_state := jsonb_set(v_state, '{dice}', to_jsonb(v_dice), true);
    v_state := jsonb_set(v_state, '{awaitingMove}', 'false'::jsonb, true);
  elsif not v_valid then
    v_next := case when v_dice = 6 then v_idx else (v_idx + 1) % array_length(v_m.player_ids, 1) end;
    v_state := jsonb_set(v_state, '{turnIndex}', to_jsonb(v_next), true);
    v_state := jsonb_set(v_state, '{consecutiveSixes}', to_jsonb(v_consecutive), true);
    v_state := jsonb_set(v_state, '{dice}', to_jsonb(v_dice), true);
    v_state := jsonb_set(v_state, '{awaitingMove}', 'false'::jsonb, true);
  else
    v_state := jsonb_set(v_state, '{dice}', to_jsonb(v_dice), true);
    v_state := jsonb_set(v_state, '{consecutiveSixes}', to_jsonb(v_consecutive), true);
    v_state := jsonb_set(v_state, '{awaitingMove}', 'true'::jsonb, true);
  end if;

  select coalesce(max(seq), 0) + 1 into v_seq from public.ludo_match_events where match_id = p_match;
  insert into public.ludo_match_events(match_id, seq, actor_id, turn_no, kind, dice, valid, payload)
  values (p_match, v_actor, v_idx, 'roll', v_dice, true, jsonb_build_object('server_authoritative', true));

  update public.ludo_matches set server_state = v_state, turn_count = greatest(turn_count, v_idx) where id = p_match;
  return jsonb_build_object('dice', v_dice, 'awaitingMove', (v_state->>'awaitingMove')::boolean, 'turnIndex', (v_state->>'turnIndex')::integer, 'consecutiveSixes', (v_state->>'consecutiveSixes')::integer);
end;
$$;

create or replace function public.ludo_server_move(p_match uuid, p_turn integer, p_token integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m public.ludo_matches;
  v_state jsonb;
  v_idx integer;
  v_actor uuid;
  v_dice integer;
  v_from integer;
  v_to integer;
  v_next integer;
  v_captured boolean := false;
  v_target_ring integer;
  v_op_idx integer;
  v_op_token integer;
  v_op_d integer;
  v_seq integer;
  v_winner boolean := false;
  v_player_tokens jsonb;
  v_op_tokens jsonb;
begin
  select * into v_m from public.ludo_matches where id = p_match for update;
  if v_m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  if v_m.status <> 'active' then raise exception 'MATCH_CLOSED'; end if;
  v_state := v_m.server_state;
  if v_state is null then raise exception 'SERVER_STATE_MISSING'; end if;
  v_idx := (v_state->>'turnIndex')::integer;
  if p_turn <> v_idx then raise exception 'STALE_TURN'; end if;
  v_actor := (v_m.player_ids)[v_idx + 1];
  if auth.uid() <> v_actor then raise exception 'NOT_CURRENT_PLAYER'; end if;
  if not coalesce((v_state->>'awaitingMove')::boolean, false) then raise exception 'NO_MOVE_PENDING'; end if;
  if p_token < 0 or p_token > 3 then raise exception 'TOKEN_OUT_OF_RANGE'; end if;

  v_dice := (v_state->>'dice')::integer;
  v_from := ((v_state->'players'->v_idx->'tokens'->p_token))::integer;
  v_to := case when v_from = 0 then 1 else v_from + v_dice end;
  if v_from = 0 and v_dice <> 6 then raise exception 'CANNOT_LEAVE_BASE_WITHOUT_SIX'; end if;
  if v_from > 0 and (v_from >= 58 or v_to > 58) then raise exception 'INVALID_TOKEN_MOVE'; end if;

  v_state := jsonb_set(v_state, array['players',v_idx::text,'tokens',p_token::text], to_jsonb(v_to), true);

  if v_to between 1 and 51 then
    v_target_ring := case when v_idx = 0 then (v_to - 1) % 52 when v_idx = 1 then (13 + v_to - 1) % 52 when v_idx = 2 then (26 + v_to - 1) % 52 else (39 + v_to - 1) % 52 end;
    if not (v_target_ring % 13 = 0 or v_target_ring % 13 = 8) then
      for v_op_idx in 0..array_length(v_m.player_ids, 1) - 1 loop
        if v_op_idx = v_idx then continue; end if;
        v_op_tokens := v_state->'players'->v_op_idx->'tokens';
        for v_op_token in 0..3 loop
          v_op_d := (v_op_tokens->v_op_token)::integer;
          if v_op_d between 1 and 51 then
            if ((case when v_op_idx = 0 then (v_op_d - 1) % 52 when v_op_idx = 1 then (13 + v_op_d - 1) % 52 when v_op_idx = 2 then (26 + v_op_d - 1) % 52 else (39 + v_op_d - 1) % 52 end) = v_target_ring) then
              v_state := jsonb_set(v_state, array['players',v_op_idx::text,'tokens',v_op_token::text], '0'::jsonb, true);
              v_captured := true;
            end if;
          end if;
        end loop;
      end loop;
    end if;
  end if;

  v_player_tokens := v_state->'players'->v_idx->'tokens';
  v_winner := true;
  for v_op_token in 0..3 loop
    if (v_player_tokens->v_op_token)::integer <> 58 then v_winner := false; exit; end if;
  end loop;

  if v_winner then
    v_state := jsonb_set(v_state, '{winnerIndex}', to_jsonb(v_idx), true);
    v_state := jsonb_set(v_state, '{winnerId}', to_jsonb(v_actor), true);
    v_state := jsonb_set(v_state, '{awaitingMove}', 'false'::jsonb, true);
    v_state := jsonb_set(v_state, '{dice}', 'null'::jsonb, true);
  else
    v_next := case when (v_dice = 6 or v_captured) and coalesce((v_state->>'consecutiveSixes')::integer,0) < 3 then v_idx else (v_idx + 1) % array_length(v_m.player_ids, 1) end;
    v_state := jsonb_set(v_state, '{turnIndex}', to_jsonb(v_next), true);
    v_state := jsonb_set(v_state, '{dice}', 'null'::jsonb, true);
    v_state := jsonb_set(v_state, '{awaitingMove}', 'false'::jsonb, true);
    if v_next <> v_idx then v_state := jsonb_set(v_state, '{consecutiveSixes}', '0'::jsonb, true); end if;
  end if;

  select coalesce(max(seq), 0) + 1 into v_seq from public.ludo_match_events where match_id = p_match;
  insert into public.ludo_match_events(match_id, seq, actor_id, turn_no, kind, from_pos, to_pos, token_index, valid, payload)
  values (p_match, v_seq, v_actor, v_idx, case when v_winner then 'win' else 'move' end, v_from, v_to, p_token, true,
          jsonb_build_object('server_authoritative', true, 'captured', v_captured));

  update public.ludo_matches
     set server_state = v_state,
         winner_id = case when v_winner then v_actor else winner_id end,
         turn_count = turn_count + 1
   where id = p_match;

  return jsonb_build_object('valid', true, 'winner', v_winner, 'winnerId', case when v_winner then v_actor else null end, 'captured', v_captured);
end;
$$;

create or replace function public.ludo_close_match(
  p_match uuid,
  p_winner uuid default null,
  p_status text default 'finished'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m public.ludo_matches;
  v_seq integer;
  v_pool integer := 0;
  v_new_balance bigint;
  v_status text := case when p_status in ('finished','aborted') then p_status else 'finished' end;
  v_winner uuid;
begin
  select * into v_m from public.ludo_matches where id = p_match for update;
  if v_m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  if not (auth.uid() = any(v_m.player_ids) or public.is_admin(auth.uid())) then raise exception 'NOT_A_PLAYER'; end if;
  if v_m.status in ('finished','aborted') then return 0; end if;

  if v_status = 'finished' then
    v_winner := nullif(v_m.server_state->>'winnerId','')::uuid;
    if v_winner is null or v_m.winner_id is null or v_winner <> v_m.winner_id then raise exception 'SERVER_WINNER_NOT_VERIFIED'; end if;
    if not (v_winner = any(v_m.player_ids)) then raise exception 'INVALID_WINNER'; end if;
    v_pool := v_m.bet_coins * coalesce(array_length(v_m.player_ids, 1), 0);
    update public.profiles set coins = coins + v_pool, updated_at = now() where id = v_winner returning coins into v_new_balance;
    if not found then raise exception 'WINNER_NOT_FOUND'; end if;
    insert into public.wallet_transactions(user_id, kind, coins_delta, balance_coins_after, ref_type, ref_id, note)
    values (v_winner, 'ludo_payout', v_pool, v_new_balance, 'ludo_match', p_match, 'Ludo winner payout');
  else
    v_winner := null;
  end if;

  select coalesce(max(seq), 0) + 1 into v_seq from public.ludo_match_events where match_id = p_match;
  insert into public.ludo_match_events(match_id, seq, actor_id, kind, payload)
  values (p_match, v_seq, v_winner, case when v_status = 'finished' then 'win' else 'abort' end,
          jsonb_build_object('winner', v_winner, 'pool', v_pool, 'server_authoritative', true));

  update public.ludo_matches set status = v_status, winner_id = v_winner, finished_at = now() where id = p_match;
  return v_pool;
end;
$$;

grant execute on function public.ludo_server_roll(uuid, integer) to authenticated;
grant execute on function public.ludo_server_move(uuid, integer, integer) to authenticated;
