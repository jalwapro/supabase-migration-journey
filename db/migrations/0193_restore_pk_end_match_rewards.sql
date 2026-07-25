-- 0193: Restore PK end-match rewards, notifications, room broadcasts, and
-- champion milestones that were dropped by 0159. Keeps 0159's escrow
-- payout/refund logic and layers 0107's broadcast + notification + champion
-- flow on top. Idempotent.

BEGIN;

CREATE OR REPLACE FUNCTION public.pk_end_match(_match_id uuid)
RETURNS public.pk_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  m public.pk_matches;
  s record;
  win uuid;
  loser uuid;
  pot bigint;
  winner_name text;
  loser_name text;
  wins_after int;
  reward_note text;
BEGIN
  SELECT * INTO m FROM public.pk_matches WHERE id = _match_id FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'match not found'; END IF;
  IF m.status <> 'active' THEN RETURN m; END IF;

  IF me IS NOT NULL AND me <> m.host_a AND me <> m.host_b THEN
    IF NOT public.has_role(me, 'admin'::app_role) THEN
      RAISE EXCEPTION 'not a participant';
    END IF;
  END IF;

  SELECT score_a, score_b INTO s FROM public.pk_match_score(m.id);
  win := CASE
    WHEN s.score_a > s.score_b THEN m.host_a
    WHEN s.score_b > s.score_a THEN m.host_b
    ELSE NULL
  END;
  loser := CASE
    WHEN win = m.host_a THEN m.host_b
    WHEN win = m.host_b THEN m.host_a
    ELSE NULL
  END;

  UPDATE public.pk_matches
     SET status = 'ended', ended_at = now(),
         score_a = s.score_a, score_b = s.score_b,
         winner_id = win
   WHERE id = m.id
  RETURNING * INTO m;

  UPDATE public.live_rooms SET active_pk_match_id = NULL
   WHERE id IN (m.room_a, m.room_b) AND active_pk_match_id = m.id;

  -- Escrow payout (2 * stake to winner, or refund on draw).
  IF m.stake_coins > 0 THEN
    pot := m.stake_coins * 2;
    IF win IS NULL THEN
      PERFORM public._pk_apply_coin_delta(m.host_a, m.stake_coins, 'pk_stake_refund', m.id, 'PK draw refund');
      PERFORM public._pk_apply_coin_delta(m.host_b, m.stake_coins, 'pk_stake_refund', m.id, 'PK draw refund');
    ELSE
      PERFORM public._pk_apply_coin_delta(win, pot, 'pk_stake_payout', m.id, 'PK match payout');
    END IF;
  END IF;

  -- History rows
  INSERT INTO public.pk_battles(host_id, room_id, room_title, my_score, opponent_name, opponent_score, result, started_at, ended_at)
  SELECT m.host_a, m.room_a,
         COALESCE((SELECT title FROM public.live_rooms WHERE id = m.room_a), 'PK Battle'),
         s.score_a,
         COALESCE((SELECT username FROM public.profiles WHERE id = m.host_b), 'Opponent'),
         s.score_b,
         CASE WHEN win = m.host_a THEN 'win' WHEN win = m.host_b THEN 'lose' ELSE 'draw' END,
         m.started_at, now();

  INSERT INTO public.pk_battles(host_id, room_id, room_title, my_score, opponent_name, opponent_score, result, started_at, ended_at)
  SELECT m.host_b, m.room_b,
         COALESCE((SELECT title FROM public.live_rooms WHERE id = m.room_b), 'PK Battle'),
         s.score_b,
         COALESCE((SELECT username FROM public.profiles WHERE id = m.host_a), 'Opponent'),
         s.score_a,
         CASE WHEN win = m.host_b THEN 'win' WHEN win = m.host_a THEN 'lose' ELSE 'draw' END,
         m.started_at, now();

  -- Names for broadcast/notification.
  SELECT username INTO winner_name FROM public.profiles WHERE id = win;
  SELECT username INTO loser_name  FROM public.profiles WHERE id = loser;

  -- Room broadcast (system message).
  BEGIN
    INSERT INTO public.room_messages(room_id, user_id, kind, text)
    SELECT rid, COALESCE(win, m.host_a), 'system'::public.message_kind,
      CASE
        WHEN win IS NULL THEN '🤝 PK Match ended in a draw!'
        ELSE '🏆 @' || COALESCE(winner_name,'host') || ' won the PK Match vs @' || COALESCE(loser_name,'host') || '!'
      END
    FROM (VALUES (m.room_a), (m.room_b)) AS t(rid);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Notifications for both hosts.
  BEGIN
    IF win IS NOT NULL THEN
      reward_note := CASE WHEN m.stake_coins > 0
        THEN ' (+' || (m.stake_coins * 2)::text || ' coins)'
        ELSE ''
      END;
      INSERT INTO public.notifications(user_id, kind, title, body, data)
      VALUES
        (win,   'pk_win',  '🏆 PK Victory!', 'You defeated @'||COALESCE(loser_name,'opponent')|| reward_note, jsonb_build_object('match_id', m.id)),
        (loser, 'pk_loss', 'PK Match ended', '@'||COALESCE(winner_name,'host')||' won this round. Rematch?', jsonb_build_object('match_id', m.id));
    ELSE
      INSERT INTO public.notifications(user_id, kind, title, body, data)
      VALUES
        (m.host_a, 'pk_draw', 'PK Draw', 'The match ended in a draw', jsonb_build_object('match_id', m.id)),
        (m.host_b, 'pk_draw', 'PK Draw', 'The match ended in a draw', jsonb_build_object('match_id', m.id));
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 10-win milestone: enqueue for admin champion approval.
  IF win IS NOT NULL THEN
    SELECT count(*) INTO wins_after FROM public.pk_battles WHERE host_id = win AND result = 'win';
    IF wins_after > 0 AND wins_after % 10 = 0 THEN
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM public.pk_champions WHERE host_id = win AND wins_total = wins_after
        ) THEN
          INSERT INTO public.pk_champions(host_id, wins_total) VALUES (win, wins_after);
          INSERT INTO public.notifications(user_id, kind, title, body, data)
          SELECT ur.user_id, 'pk_champion_pending', '⭐ New PK Champion',
                 '@'||COALESCE(winner_name,'host')||' hit '||wins_after||' PK wins — review for banner',
                 jsonb_build_object('host_id', win, 'wins', wins_after)
          FROM public.user_roles ur
          WHERE ur.role = 'admin'::app_role;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END IF;

  RETURN m;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pk_end_match(uuid) TO authenticated;

COMMIT;
