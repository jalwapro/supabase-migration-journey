-- 20261006160000: security hardening for role governance and server-authoritative Ludo.

drop policy if exists "Admins manage roles" on public.user_roles;
CREATE OR REPLACE FUNCTION public.ludo_close_match(p_match uuid, p_winner uuid DEFAULT NULL::uuid, p_status text DEFAULT 'finished'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_m public.ludo_matches;
begin
  select * into v_m from public.ludo_matches where id = p_match for update;
  if v_m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  if not (auth.uid() = any(v_m.player_ids) or public.is_admin(auth.uid())) then
    raise exception 'NOT_A_PLAYER';
  end if;
  if v_m.status in ('finished','aborted') then
    return 0;
  end if;
  raise exception 'SERVER_AUTHORIZED_MOVE_REQUIRED';
end;
$function$


CREATE OR REPLACE FUNCTION public.ludo_get_state(p_match uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_m public.ludo_matches;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_m from public.ludo_matches where id = p_match;
  if v_m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  if not (v_uid = any(v_m.player_ids)) then raise exception 'NOT_A_PLAYER'; end if;

  return jsonb_build_object(
    'id', v_m.id,
    'bet_coins', v_m.bet_coins,
    'status', v_m.status,
    'server_state', v_m.server_state,
    'winner_id', v_m.winner_id
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.ludo_server_move(p_match uuid, p_turn integer, p_token integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_pool bigint := 0;
  v_new_balance bigint;
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
    v_target_ring := case
      when v_idx = 0 then (v_to - 1) % 52
      when v_idx = 1 then (13 + v_to - 1) % 52
      when v_idx = 2 then (26 + v_to - 1) % 52
      else (39 + v_to - 1) % 52
    end;

    if not (v_target_ring % 13 = 0 or v_target_ring % 13 = 8) then
      for v_op_idx in 0..array_length(v_m.player_ids, 1) - 1 loop
        if v_op_idx = v_idx then continue; end if;
        v_op_tokens := v_state->'players'->v_op_idx->'tokens';
        for v_op_token in 0..3 loop
          v_op_d := (v_op_tokens->v_op_token)::integer;
          if v_op_d between 1 and 51 then
            if ((case
              when v_op_idx = 0 then (v_op_d - 1) % 52
              when v_op_idx = 1 then (13 + v_op_d - 1) % 52
              when v_op_idx = 2 then (26 + v_op_d - 1) % 52
              else (39 + v_op_d - 1) % 52
            end) = v_target_ring) then
              v_state := jsonb_set(
                v_state,
                array['players',v_op_idx::text,'tokens',v_op_token::text],
                '0'::jsonb, true
              );
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
    if (v_player_tokens->v_op_token)::integer <> 58 then
      v_winner := false;
      exit;
    end if;
  end loop;

  if v_winner then
    v_state := jsonb_set(v_state, '{winnerIndex}', to_jsonb(v_idx), true);
    v_state := jsonb_set(v_state, '{winnerId}', to_jsonb(v_actor), true);
    v_state := jsonb_set(v_state, '{awaitingMove}', 'false'::jsonb, true);
    v_state := jsonb_set(v_state, '{dice}', 'null'::jsonb, true);

    v_pool := coalesce(v_m.bet_coins, 0)::bigint * coalesce(array_length(v_m.player_ids, 1), 0);
    update public.profiles
      set coins = coins + v_pool, updated_at = now()
      where id = v_actor
      returning coins into v_new_balance;
    if not found then raise exception 'WINNER_NOT_FOUND'; end if;

    insert into public.wallet_transactions
      (user_id, kind, coins_delta, balance_coins_after, ref_type, ref_id, note)
    values
      (v_actor, 'ludo_payout', v_pool, v_new_balance, 'ludo_match', p_match,
       'Ludo winner payout');

    update public.ludo_matches
      set server_state = v_state, winner_id = v_actor, status = 'finished', finished_at = now(),
          turn_count = turn_count + 1
      where id = p_match;
  else
    v_next := case
      when (v_dice = 6 or v_captured) and coalesce((v_state->>'consecutiveSixes')::integer,0) < 3
        then v_idx
      else (v_idx + 1) % array_length(v_m.player_ids, 1)
    end;
    v_state := jsonb_set(v_state, '{turnIndex}', to_jsonb(v_next), true);
    v_state := jsonb_set(v_state, '{dice}', 'null'::jsonb, true);
    v_state := jsonb_set(v_state, '{awaitingMove}', 'false'::jsonb, true);
    if v_next <> v_idx then
      v_state := jsonb_set(v_state, '{consecutiveSixes}', '0'::jsonb, true);
    end if;

    update public.ludo_matches
      set server_state = v_state, turn_count = turn_count + 1
      where id = p_match;
  end if;

  select coalesce(max(seq), 0) + 1 into v_seq from public.ludo_match_events where match_id = p_match;
  insert into public.ludo_match_events(match_id, seq, actor_id, turn_no, kind, from_pos, to_pos, token_index, valid, payload)
  values (
    p_match, v_seq, v_actor, v_idx,
    case when v_winner then 'win' else 'move' end,
    v_from, v_to, p_token, true,
    jsonb_build_object('server_authoritative', true, 'captured', v_captured)
  );

  return jsonb_build_object(
    'valid', true,
    'winner', v_winner,
    'winnerId', case when v_winner then v_actor else null end,
    'captured', v_captured,
    'server_state', v_state,
    'payout', v_pool
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.ludo_server_roll(p_match uuid, p_turn integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  values (p_match, v_seq, v_actor, v_idx, 'roll', v_dice, true,
          jsonb_build_object('server_authoritative', true));

  update public.ludo_matches
  set server_state = v_state, turn_count = greatest(turn_count, v_idx)
  where id = p_match;

  return jsonb_build_object(
    'dice', v_dice,
    'awaitingMove', (v_state->>'awaitingMove')::boolean,
    'turnIndex', (v_state->>'turnIndex')::integer,
    'consecutiveSixes', (v_state->>'consecutiveSixes')::integer,
    'server_state', v_state
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.manage_user_role(_user_id uuid, _role text, _action text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_count integer;
  v_existing boolean;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.user_roles
    where user_id = v_actor
      and role = 'super_admin'
  ) then
    raise exception 'SUPER_ADMIN_REQUIRED';
  end if;

  if _user_id is null then raise exception 'USER_REQUIRED'; end if;
  if _role not in ('host','agent','moderator','admin','super_admin') then
    raise exception 'INVALID_ROLE';
  end if;
  if _action not in ('grant','revoke') then
    raise exception 'INVALID_ACTION';
  end if;

  if _action = 'grant' then
    insert into public.user_roles(user_id, role)
    values (_user_id, _role)
    on conflict (user_id, role) do nothing;

    return true;
  end if;

  if _user_id = v_actor then
    raise exception 'SELF_REVOCATION_FORBIDDEN';
  end if;

  select exists(
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  ) into v_existing;

  if not v_existing then
    return false;
  end if;

  if _role = 'super_admin' then
    select count(*) into v_count
    from public.user_roles
    where role = 'super_admin';

    if v_count <= 1 then
      raise exception 'LAST_SUPER_ADMIN_PROTECTED';
    end if;
  end if;

  delete from public.user_roles
  where user_id = _user_id
    and role = _role;

  return true;
end;
$function$


revoke execute on function public.manage_user_role(uuid,text,text) from public, anon;
grant execute on function public.manage_user_role(uuid,text,text) to authenticated;
revoke execute on function public.ludo_server_roll(uuid,integer) from public, anon;
revoke execute on function public.ludo_server_move(uuid,integer,integer) from public, anon;
revoke execute on function public.ludo_get_state(uuid) from public, anon;
grant execute on function public.ludo_server_roll(uuid,integer) to authenticated;
grant execute on function public.ludo_server_move(uuid,integer,integer) to authenticated;
grant execute on function public.ludo_get_state(uuid) to authenticated;
