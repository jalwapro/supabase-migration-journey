-- 0363: Correct the server-roll event insert introduced by 0362.

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
  v_tokens := v_state->'players'->v_idx->'tokens';
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
  values (p_match, v_seq, v_actor, v_idx, 'roll', v_dice, true, jsonb_build_object('server_authoritative', true));

  update public.ludo_matches
     set server_state = v_state,
         turn_count = greatest(turn_count, v_idx)
   where id = p_match;

  return jsonb_build_object(
    'dice', v_dice,
    'awaitingMove', (v_state->>'awaitingMove')::boolean,
    'turnIndex', (v_state->>'turnIndex')::integer,
    'consecutiveSixes', (v_state->>'consecutiveSixes')::integer
  );
end;
$$;

grant execute on function public.ludo_server_roll(uuid, integer) to authenticated;
