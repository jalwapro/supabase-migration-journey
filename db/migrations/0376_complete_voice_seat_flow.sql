-- 0376: complete canonical voice-seat flow.
-- Valid voice seats: 1..20. Seat 1 is host-only. Seats 2..20 are users.
-- Covers invite accept + seat locks so no legacy 0-based behavior remains.

BEGIN;

CREATE OR REPLACE FUNCTION public.accept_seat_invite(_invite_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  inv record;
  r record;
  target_seat integer;
  i integer;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO inv
    FROM public.seat_invites
   WHERE id = _invite_id
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'invite not found'; END IF;
  IF inv.to_user <> me THEN RAISE EXCEPTION 'not your invite'; END IF;
  IF inv.status <> 'pending' THEN RAISE EXCEPTION 'invite already responded'; END IF;

  SELECT host_id, room_type::text AS room_type, status::text AS status,
         COALESCE(locked_seats, '{}'::int[]) AS locked
    INTO r
    FROM public.live_rooms
   WHERE id = inv.room_id;

  IF r.host_id IS NULL THEN RAISE EXCEPTION 'room not found'; END IF;
  IF r.room_type <> 'voice' THEN RAISE EXCEPTION 'not a voice room'; END IF;
  IF r.status <> 'live' THEN RAISE EXCEPTION 'room is not live'; END IF;

  PERFORM public._room_seat_lock(inv.room_id);

  IF inv.seat_index IS NOT NULL THEN
    IF inv.seat_index < 2 OR inv.seat_index > 20 THEN
      RAISE EXCEPTION 'invalid voice seat number';
    END IF;
    IF inv.seat_index = ANY(r.locked) THEN
      RAISE EXCEPTION 'seat is locked';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.room_members
       WHERE room_id = inv.room_id AND seat_index = inv.seat_index
    ) THEN
      RAISE EXCEPTION 'seat already taken';
    END IF;
    target_seat := inv.seat_index;
  ELSE
    FOR i IN 2..20 LOOP
      IF i <> ALL(r.locked)
         AND NOT EXISTS (
           SELECT 1 FROM public.room_members
            WHERE room_id = inv.room_id AND seat_index = i
         ) THEN
        target_seat := i;
        EXIT;
      END IF;
    END LOOP;
    IF target_seat IS NULL THEN RAISE EXCEPTION 'no free seat'; END IF;
  END IF;

  -- The guard requires the invite to be accepted while the member row is written.
  UPDATE public.seat_invites
     SET status = 'accepted',
         responded_at = now(),
         seat_index = target_seat
   WHERE id = _invite_id;

  INSERT INTO public.room_members (room_id, user_id, seat_index, seated_at)
  VALUES (inv.room_id, me, target_seat, now())
  ON CONFLICT (room_id, user_id) DO UPDATE
     SET seat_index = EXCLUDED.seat_index,
         seated_at = EXCLUDED.seated_at;

  UPDATE public.seat_invites
     SET status = 'used',
         consumed_at = now()
   WHERE id = _invite_id;

  RETURN target_seat;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_seat_lock(
  _room_id uuid,
  _seat_index integer,
  _locked boolean
)
RETURNS integer[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  r_host uuid;
  cur integer[];
  mod_ok boolean;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _seat_index < 2 OR _seat_index > 20 THEN
    RAISE EXCEPTION 'invalid voice seat number';
  END IF;

  SELECT host_id, COALESCE(locked_seats, '{}'::int[])
    INTO r_host, cur
    FROM public.live_rooms
   WHERE id = _room_id
   FOR UPDATE;

  IF r_host IS NULL THEN RAISE EXCEPTION 'room not found'; END IF;

  SELECT COALESCE(is_moderator, false) INTO mod_ok
    FROM public.room_members
   WHERE room_id = _room_id AND user_id = me;

  IF me <> r_host AND NOT COALESCE(mod_ok, false) THEN
    RAISE EXCEPTION 'only host or moderator can lock seats';
  END IF;

  IF _locked THEN
    IF NOT (_seat_index = ANY(cur)) THEN
      cur := array_append(cur, _seat_index);
    END IF;
  ELSE
    cur := array_remove(cur, _seat_index);
  END IF;

  UPDATE public.live_rooms SET locked_seats = cur WHERE id = _room_id;
  RETURN cur;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_seat_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_seat_invite(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.toggle_seat_lock(uuid, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_seat_lock(uuid, integer, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
