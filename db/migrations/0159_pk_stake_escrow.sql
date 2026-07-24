-- 0159_pk_stake_escrow.sql
-- C4: PK Stake Escrow
--
-- Problems this fixes:
--  1. Client called `pk_invites.update({ stake_coins })` directly, but there
--     is no UPDATE policy on pk_invites (writes forced through RPC). The
--     stake was silently dropped -- coins never held, winner never paid.
--  2. Even if the update had succeeded, no coins were deducted from either
--     host on invite/accept, so hosts could stake coins they didn't own.
--  3. `pk_end_match` never distributed the pot to the winner or refunded
--     on a draw. Same for declined/expired invites -- sender's coins would
--     have stayed locked forever.
--
-- Fix: atomic escrow in three RPCs
--   pk_send_invite(_to_host, _duration_sec, _stake_coins)
--     - Validates balance, deducts stake from challenger, logs pk_stake_hold.
--   pk_respond_invite(_invite_id, _accept)
--     - Accept: validates responder balance, deducts stake, records pot on
--       pk_matches, marks invite accepted.
--     - Decline / expired: refunds challenger, logs pk_stake_refund.
--   pk_end_match(_match_id)
--     - Winner takes 2*stake (logs pk_stake_payout).
--     - Draw refunds both hosts (logs pk_stake_refund).
--
-- Also updates the expiry sweep to refund the challenger on auto-expire.
--
-- Trusted marker (`app.trusted_definer`) is used so the profiles guard
-- trigger from 0156 allows the coin adjustments from inside these
-- SECURITY DEFINER RPCs.

BEGIN;

-- Small helper to keep repeated escrow logic tidy.
CREATE OR REPLACE FUNCTION public._pk_apply_coin_delta(
  _user_id uuid,
  _delta bigint,
  _kind text,
  _ref_id uuid,
  _note text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance bigint;
BEGIN
  PERFORM set_config('app.trusted_definer', 'on', true);

  UPDATE public.profiles
     SET coins = coins + _delta,
         updated_at = now()
   WHERE id = _user_id
   RETURNING coins INTO _new_balance;

  PERFORM set_config('app.trusted_definer', 'off', true);

  IF _new_balance IS NULL THEN
    RAISE EXCEPTION 'profile not found for %', _user_id;
  END IF;
  IF _new_balance < 0 THEN
    RAISE EXCEPTION 'insufficient coins';
  END IF;

  INSERT INTO public.wallet_transactions
    (user_id, kind, coins, coins_delta, ref_type, ref_id, note, balance_coins_after)
  VALUES
    (_user_id, _kind, _delta, _delta, 'pk_match', _ref_id, _note, _new_balance);

  RETURN _new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public._pk_apply_coin_delta(uuid, bigint, text, uuid, text) FROM public;

-- ---------------------------------------------------------------
-- 1) pk_send_invite: accept _stake_coins, escrow atomically
-- ---------------------------------------------------------------
DROP FUNCTION IF EXISTS public.pk_send_invite(uuid, int);
DROP FUNCTION IF EXISTS public.pk_send_invite(uuid, int, int);

CREATE OR REPLACE FUNCTION public.pk_send_invite(
  _to_host uuid,
  _duration_sec int,
  _stake_coins int DEFAULT 0
)
RETURNS public.pk_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  my_room public.live_rooms;
  their_room public.live_rooms;
  my_coins bigint;
  inv public.pk_invites;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF me = _to_host THEN RAISE EXCEPTION 'cannot challenge yourself'; END IF;
  IF _duration_sec NOT IN (180, 300, 600) THEN RAISE EXCEPTION 'invalid duration'; END IF;
  IF _stake_coins IS NULL OR _stake_coins < 0 THEN RAISE EXCEPTION 'invalid stake'; END IF;

  SELECT * INTO my_room FROM public.live_rooms
    WHERE host_id = me AND status = 'live'
    ORDER BY created_at DESC LIMIT 1;
  IF my_room.id IS NULL THEN RAISE EXCEPTION 'you must be live to challenge'; END IF;
  IF my_room.active_pk_match_id IS NOT NULL THEN RAISE EXCEPTION 'already in a PK match'; END IF;

  SELECT * INTO their_room FROM public.live_rooms
    WHERE host_id = _to_host AND status = 'live'
    ORDER BY created_at DESC LIMIT 1;
  IF their_room.id IS NULL THEN RAISE EXCEPTION 'opponent is not live'; END IF;
  IF their_room.active_pk_match_id IS NOT NULL THEN RAISE EXCEPTION 'opponent already in a PK'; END IF;

  -- balance check before locking anything
  IF _stake_coins > 0 THEN
    SELECT coins INTO my_coins FROM public.profiles WHERE id = me FOR UPDATE;
    IF my_coins IS NULL OR my_coins < _stake_coins THEN
      RAISE EXCEPTION 'insufficient coins for stake';
    END IF;
  END IF;

  -- Refund any prior pending invites we sent to this opponent, then expire.
  PERFORM public._pk_apply_coin_delta(me, prev.stake_coins, 'pk_stake_refund', prev.id,
            'PK invite superseded')
  FROM public.pk_invites prev
  WHERE prev.status = 'pending'
    AND prev.from_host = me
    AND prev.to_host = _to_host
    AND prev.stake_coins > 0;

  UPDATE public.pk_invites
     SET status = 'expired'
   WHERE status = 'pending'
     AND ((from_host = me AND to_host = _to_host)
       OR (from_host = _to_host AND to_host = me));

  INSERT INTO public.pk_invites(from_host, to_host, from_room, to_room, duration_sec, stake_coins)
  VALUES (me, _to_host, my_room.id, their_room.id, _duration_sec, _stake_coins)
  RETURNING * INTO inv;

  IF _stake_coins > 0 THEN
    PERFORM public._pk_apply_coin_delta(me, -_stake_coins, 'pk_stake_hold', inv.id,
              'PK invite stake escrow');
  END IF;

  RETURN inv;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pk_send_invite(uuid, int, int) TO authenticated;

-- ---------------------------------------------------------------
-- 2) pk_respond_invite: escrow responder on accept, refund on decline
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pk_respond_invite(_invite_id uuid, _accept boolean)
RETURNS public.pk_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  inv public.pk_invites;
  m public.pk_matches;
  my_room public.live_rooms;
  my_coins bigint;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT * INTO inv FROM public.pk_invites WHERE id = _invite_id FOR UPDATE;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'invite not found'; END IF;
  IF inv.to_host <> me THEN RAISE EXCEPTION 'not your invite'; END IF;
  IF inv.status <> 'pending' THEN RAISE EXCEPTION 'invite already handled'; END IF;

  IF inv.expires_at < now() THEN
    UPDATE public.pk_invites SET status = 'expired' WHERE id = inv.id;
    IF inv.stake_coins > 0 THEN
      PERFORM public._pk_apply_coin_delta(inv.from_host, inv.stake_coins,
                'pk_stake_refund', inv.id, 'PK invite expired');
    END IF;
    RAISE EXCEPTION 'invite expired';
  END IF;

  IF NOT _accept THEN
    UPDATE public.pk_invites SET status = 'declined', responded_at = now() WHERE id = inv.id;
    IF inv.stake_coins > 0 THEN
      PERFORM public._pk_apply_coin_delta(inv.from_host, inv.stake_coins,
                'pk_stake_refund', inv.id, 'PK invite declined');
    END IF;
    RETURN NULL;
  END IF;

  -- responder balance check + escrow
  IF inv.stake_coins > 0 THEN
    SELECT coins INTO my_coins FROM public.profiles WHERE id = me FOR UPDATE;
    IF my_coins IS NULL OR my_coins < inv.stake_coins THEN
      RAISE EXCEPTION 'insufficient coins to accept this stake';
    END IF;
  END IF;

  SELECT * INTO my_room FROM public.live_rooms
    WHERE host_id = me AND status = 'live'
    ORDER BY created_at DESC LIMIT 1;
  IF my_room.id IS NULL THEN RAISE EXCEPTION 'you must be live to accept'; END IF;
  IF my_room.active_pk_match_id IS NOT NULL THEN RAISE EXCEPTION 'you are already in a PK'; END IF;

  INSERT INTO public.pk_matches(host_a, host_b, room_a, room_b, duration_sec, ends_at, stake_coins)
  VALUES (inv.from_host, me, inv.from_room, my_room.id, inv.duration_sec,
          now() + make_interval(secs => inv.duration_sec), inv.stake_coins)
  RETURNING * INTO m;

  UPDATE public.live_rooms SET active_pk_match_id = m.id WHERE id IN (m.room_a, m.room_b);
  UPDATE public.pk_invites SET status = 'accepted', responded_at = now(), match_id = m.id WHERE id = inv.id;

  IF inv.stake_coins > 0 THEN
    PERFORM public._pk_apply_coin_delta(me, -inv.stake_coins, 'pk_stake_hold', m.id,
              'PK match stake escrow');
  END IF;

  RETURN m;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pk_respond_invite(uuid, boolean) TO authenticated;

-- ---------------------------------------------------------------
-- 3) pk_end_match: payout winner, refund on draw
-- ---------------------------------------------------------------
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
  pot bigint;
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

  UPDATE public.pk_matches
     SET status = 'ended', ended_at = now(),
         score_a = s.score_a, score_b = s.score_b,
         winner_id = win
   WHERE id = m.id
  RETURNING * INTO m;

  UPDATE public.live_rooms SET active_pk_match_id = NULL
   WHERE id IN (m.room_a, m.room_b) AND active_pk_match_id = m.id;

  -- Payout: total pot = 2 * stake (both hosts escrowed)
  IF m.stake_coins > 0 THEN
    pot := m.stake_coins * 2;
    IF win IS NULL THEN
      -- draw: refund both
      PERFORM public._pk_apply_coin_delta(m.host_a, m.stake_coins, 'pk_stake_refund', m.id, 'PK draw refund');
      PERFORM public._pk_apply_coin_delta(m.host_b, m.stake_coins, 'pk_stake_refund', m.id, 'PK draw refund');
    ELSE
      PERFORM public._pk_apply_coin_delta(win, pot, 'pk_stake_payout', m.id, 'PK match payout');
    END IF;
  END IF;

  -- history rows (unchanged from 0087)
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

  RETURN m;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pk_end_match(uuid) TO authenticated;

-- ---------------------------------------------------------------
-- 4) Auto-refund on expiry sweep (extends 0129 trigger)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pk_invites_sweep_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, from_host, stake_coins
      FROM public.pk_invites
     WHERE status = 'pending'
       AND expires_at < now()
       AND stake_coins > 0
  LOOP
    PERFORM public._pk_apply_coin_delta(r.from_host, r.stake_coins,
              'pk_stake_refund', r.id, 'PK invite auto-expired');
  END LOOP;

  UPDATE public.pk_invites
     SET status = 'expired'
   WHERE status = 'pending'
     AND expires_at < now();

  RETURN NEW;
END;
$$;

COMMIT;
