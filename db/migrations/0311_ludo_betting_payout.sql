-- Ludo coin betting and atomic winner payout.
-- Only real seated room players are funded; bots are never charged.

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
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_room is null then raise exception 'ROOM_REQUIRED'; end if;
  if p_bet not in (100, 500, 1000, 5000) then raise exception 'INVALID_BET'; end if;
  if p_players is null or coalesce(array_length(p_players, 1), 0) < 2 then
    raise exception 'AT_LEAST_TWO_PLAYERS_REQUIRED';
  end if;
  if not (v_uid = any(p_players)) then raise exception 'NOT_A_PLAYER'; end if;
  if (select count(*) from unnest(p_players)) <> (select count(distinct x) from unnest(p_players) x) then
    raise exception 'DUPLICATE_PLAYERS';
  end if;

  select count(*) into v_count
  from unnest(p_players) as x
  where exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room
      and rm.user_id = x
      and rm.seat_index is not null
  );
  if v_count <> array_length(p_players, 1) then
    raise exception 'ALL_PLAYERS_MUST_BE_SEATED';
  end if;

  foreach v_player in array p_players loop
    update public.profiles
       set coins = coins - p_bet, updated_at = now()
     where id = v_player and coins >= p_bet;
    if not found then
      raise exception 'PLAYER_NOT_ENOUGH_COINS:%', v_player;
    end if;
    insert into public.wallet_transactions(user_id, kind, coins, note)
    values (v_player, 'ludo_bet', -p_bet, 'Ludo match entry bet');
  end loop;

  insert into public.ludo_matches(room_id, player_ids, bet_coins, seed)
  values (p_room, p_players, p_bet, encode(gen_random_bytes(8), 'hex'))
  returning id into v_id;

  insert into public.ludo_match_events(match_id, seq, actor_id, kind, payload)
  values (v_id, 1, v_uid, 'start', jsonb_build_object('players', p_players, 'bet', p_bet));

  return v_id;
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
  v_status text := case when p_status in ('finished','aborted') then p_status else 'finished' end;
begin
  select * into v_m from public.ludo_matches where id = p_match for update;
  if v_m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  if not (auth.uid() = any(v_m.player_ids) or public.is_admin(auth.uid())) then
    raise exception 'NOT_A_PLAYER';
  end if;
  if v_m.status in ('finished','aborted') then
    return 0;
  end if;

  if v_status = 'finished' then
    if p_winner is null or not (p_winner = any(v_m.player_ids)) then
      raise exception 'INVALID_WINNER';
    end if;
    v_pool := v_m.bet_coins * coalesce(array_length(v_m.player_ids, 1), 0);
    update public.profiles
       set coins = coins + v_pool, updated_at = now()
     where id = p_winner;
    if not found then raise exception 'WINNER_NOT_FOUND'; end if;
    insert into public.wallet_transactions(user_id, kind, coins, note)
    values (p_winner, 'ludo_payout', v_pool, 'Ludo winner payout');
  end if;

  select coalesce(max(seq), 0) + 1 into v_seq
  from public.ludo_match_events where match_id = p_match;
  insert into public.ludo_match_events(match_id, seq, actor_id, kind, payload)
  values (p_match, v_seq, p_winner,
          case when v_status = 'finished' then 'win' else 'abort' end,
          jsonb_build_object('winner', p_winner, 'pool', v_pool));

  update public.ludo_matches
     set status = v_status, winner_id = p_winner, finished_at = now()
   where id = p_match;

  return v_pool;
end;
$$;
