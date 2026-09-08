-- 0371: Voice rooms are fixed at 20 seats: seat 1 = creator/host, seats 2..20 = regular users.
-- Host may move between seat 1 and any regular seat; seat 1 remains protected.

BEGIN;

DO $$
DECLARE
  m record;
  target integer;
BEGIN
  UPDATE public.room_members rm
     SET seat_index = -200000 - sub.rn
    FROM (
      SELECT rm2.room_id, rm2.user_id,
             row_number() over (partition by rm2.room_id order by rm2.user_id) AS rn
        FROM public.room_members rm2
        JOIN public.live_rooms lr ON lr.id = rm2.room_id
       WHERE lr.room_type::text = 'voice'
         AND rm2.seat_index = 1
         AND rm2.user_id <> lr.host_id
    ) sub
   WHERE rm.room_id = sub.room_id AND rm.user_id = sub.user_id;

  UPDATE public.room_members rm
     SET seat_index = 1
    FROM public.live_rooms lr
   WHERE lr.id = rm.room_id
     AND lr.room_type::text = 'voice'
     AND rm.user_id = lr.host_id
     AND rm.seat_index = 0;

  FOR m IN
    SELECT rm.room_id, rm.user_id
      FROM public.room_members rm
      JOIN public.live_rooms lr ON lr.id = rm.room_id
     WHERE lr.room_type::text = 'voice' AND rm.seat_index < 0
     ORDER BY rm.room_id, rm.seat_index, rm.user_id
  LOOP
    SELECT min(s) INTO target
      FROM generate_series(2, 20) AS s
     WHERE NOT EXISTS (
       SELECT 1 FROM public.room_members x
        WHERE x.room_id = m.room_id AND x.seat_index = s
     );
    IF target IS NULL THEN
      RAISE EXCEPTION 'voice room % has no free regular seat while repairing seat 1', m.room_id;
    END IF;
    UPDATE public.room_members
       SET seat_index = target, seated_at = coalesce(seated_at, now())
     WHERE room_id = m.room_id AND user_id = m.user_id;
  END LOOP;

  UPDATE public.live_rooms SET seat_count = 20
   WHERE room_type::text = 'voice' AND seat_count IS DISTINCT FROM 20;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_voice_room_seat_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.room_type::text = 'voice' THEN NEW.seat_count := 20; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_voice_room_seat_capacity ON public.live_rooms;
CREATE TRIGGER trg_enforce_voice_room_seat_capacity
BEFORE INSERT OR UPDATE OF room_type, seat_count ON public.live_rooms
FOR EACH ROW EXECUTE FUNCTION public.enforce_voice_room_seat_capacity();

CREATE OR REPLACE FUNCTION public.enforce_voice_room_seat_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  IF current_user IN ('postgres', 'service_role') THEN RETURN NEW; END IF;
  SELECT id, host_id, room_type::text AS room_type INTO r FROM public.live_rooms WHERE id = NEW.room_id;
  IF r.room_type <> 'voice' THEN RETURN NEW; END IF;
  IF NEW.user_id = r.host_id AND NEW.seat_index = 0 THEN NEW.seat_index := 1; END IF;
  IF NEW.seat_index IS NULL THEN RETURN NEW; END IF;
  IF NEW.seat_index < 1 OR NEW.seat_index > 20 THEN
    RAISE EXCEPTION 'Invalid voice seat. Valid seats are 1 through 20';
  END IF;
  IF NEW.seat_index = 1 AND NEW.user_id <> r.host_id THEN
    RAISE EXCEPTION 'Only room owner can occupy the host seat';
  END IF;
  IF auth.uid() IS NULL OR NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only occupy your own seat';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_self_seat_claim_ins ON public.room_members;
DROP TRIGGER IF EXISTS trg_guard_self_seat_claim_upd ON public.room_members;
DROP TRIGGER IF EXISTS trg_enforce_voice_room_seat_membership_ins ON public.room_members;
DROP TRIGGER IF EXISTS trg_enforce_voice_room_seat_membership_upd ON public.room_members;
CREATE TRIGGER trg_enforce_voice_room_seat_membership_ins
BEFORE INSERT ON public.room_members FOR EACH ROW
EXECUTE FUNCTION public.enforce_voice_room_seat_membership();
CREATE TRIGGER trg_enforce_voice_room_seat_membership_upd
BEFORE UPDATE OF seat_index ON public.room_members FOR EACH ROW
EXECUTE FUNCTION public.enforce_voice_room_seat_membership();

DROP POLICY IF EXISTS "voice seat invariant insert" ON public.room_members;
CREATE POLICY "voice seat invariant insert" ON public.room_members AS RESTRICTIVE
FOR INSERT TO authenticated WITH CHECK (
  NOT EXISTS (SELECT 1 FROM public.live_rooms r WHERE r.id = room_members.room_id AND r.room_type::text = 'voice')
  OR room_members.seat_index IS NULL
  OR (
    room_members.seat_index BETWEEN 1 AND 20
    AND EXISTS (
      SELECT 1 FROM public.live_rooms r
      WHERE r.id = room_members.room_id AND r.room_type::text = 'voice'
        AND room_members.user_id = r.host_id AND room_members.seat_index = 1
    )
  )
);

DROP POLICY IF EXISTS "voice seat invariant update" ON public.room_members;
CREATE POLICY "voice seat invariant update" ON public.room_members AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (
  auth.uid() = room_members.user_id
  OR EXISTS (SELECT 1 FROM public.live_rooms r WHERE r.id = room_members.room_id AND r.host_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.room_members me
    WHERE me.room_id = room_members.room_id AND me.user_id = auth.uid() AND coalesce(me.is_moderator, false)
  )
)
WITH CHECK (
  NOT EXISTS (SELECT 1 FROM public.live_rooms r WHERE r.id = room_members.room_id AND r.room_type::text = 'voice')
  OR room_members.seat_index IS NULL
  OR (
    room_members.seat_index BETWEEN 1 AND 20
    AND (
      room_members.seat_index <> 1
      OR EXISTS (
        SELECT 1 FROM public.live_rooms r
        WHERE r.id = room_members.room_id AND r.room_type::text = 'voice'
          AND room_members.user_id = r.host_id
      )
    )
  )
);

CREATE OR REPLACE FUNCTION public.take_seat(_room_id uuid, _seat_index integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  r_host uuid; r_status text; r_type text; r_locked int[];
  occupant uuid; am_mod boolean; member_exists boolean;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public._room_seat_lock(_room_id);
  SELECT host_id, status::text, room_type::text, coalesce(locked_seats, '{}'::int[])
    INTO r_host, r_status, r_type, r_locked FROM public.live_rooms WHERE id = _room_id;
  IF r_host IS NULL THEN RAISE EXCEPTION 'room not found'; END IF;
  IF r_status <> 'live' THEN RAISE EXCEPTION 'room is not live'; END IF;
  IF r_type <> 'voice' THEN RAISE EXCEPTION 'not a voice room'; END IF;
  IF _seat_index < 1 OR _seat_index > 20 THEN RAISE EXCEPTION 'invalid voice seat number'; END IF;
  SELECT exists (SELECT 1 FROM public.room_members WHERE room_id = _room_id AND user_id = me) INTO member_exists;
  IF NOT member_exists THEN RAISE EXCEPTION 'Join the room before taking a seat'; END IF;
  IF _seat_index = 1 AND me <> r_host THEN RAISE EXCEPTION 'Only room owner can occupy the host seat'; END IF;
  IF _seat_index = any(r_locked) AND me <> r_host THEN
    SELECT coalesce(is_moderator, false) INTO am_mod FROM public.room_members WHERE room_id = _room_id AND user_id = me;
    IF NOT coalesce(am_mod, false) THEN RAISE EXCEPTION 'Seat is locked'; END IF;
  END IF;
  SELECT user_id INTO occupant FROM public.room_members WHERE room_id = _room_id AND seat_index = _seat_index;
  IF occupant IS NOT NULL AND occupant <> me THEN RAISE EXCEPTION 'Seat is already occupied'; END IF;
  UPDATE public.room_members SET seat_index = _seat_index, seated_at = now()
   WHERE room_id = _room_id AND user_id = me;
  IF NOT FOUND THEN RAISE EXCEPTION 'Join the room before taking a seat'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.take_seat(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.take_seat(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.take_available_voice_seat(_room_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid(); r_host uuid; r_status text; r_type text; target_idx int; i int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public._room_seat_lock(_room_id);
  SELECT host_id, status::text, room_type::text INTO r_host, r_status, r_type FROM public.live_rooms WHERE id = _room_id;
  IF r_host IS NULL THEN RAISE EXCEPTION 'room not found'; END IF;
  IF r_status <> 'live' THEN RAISE EXCEPTION 'room is not live'; END IF;
  IF r_type <> 'voice' THEN RAISE EXCEPTION 'not a voice room'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.room_members WHERE room_id = _room_id AND user_id = me) THEN RAISE EXCEPTION 'Join the room before taking a seat'; END IF;
  SELECT seat_index INTO target_idx FROM public.room_members WHERE room_id = _room_id AND user_id = me AND seat_index IS NOT NULL;
  IF target_idx IS NOT NULL THEN RETURN target_idx; END IF;
  IF me = r_host THEN target_idx := 1;
  ELSE
    FOR i IN 2..20 LOOP
      IF NOT EXISTS (SELECT 1 FROM public.room_members WHERE room_id = _room_id AND seat_index = i) THEN target_idx := i; EXIT; END IF;
    END LOOP;
  END IF;
  IF target_idx IS NULL THEN RAISE EXCEPTION 'No available seat'; END IF;
  PERFORM public.take_seat(_room_id, target_idx);
  RETURN target_idx;
END;
$$;

REVOKE ALL ON FUNCTION public.take_available_voice_seat(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.take_available_voice_seat(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
