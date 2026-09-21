-- 0375: finalize canonical 1..20 voice-seat RPCs.
-- Voice seat 1 is the host; regular users use seats 2..20.

BEGIN;

CREATE OR REPLACE FUNCTION public.request_seat(_room_id uuid, _seat_index int)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  r record;
  seat_taken boolean;
  req_id uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT host_id, room_type::text AS room_type, status::text AS status,
         COALESCE(locked_seats, '{}'::int[]) AS locked
    INTO r
    FROM public.live_rooms
   WHERE id = _room_id;

  IF r.host_id IS NULL THEN RAISE EXCEPTION 'room not found'; END IF;
  IF r.room_type <> 'voice' THEN RAISE EXCEPTION 'not a voice room'; END IF;
  IF r.status <> 'live' THEN RAISE EXCEPTION 'room is not live'; END IF;
  IF r.host_id = me THEN RAISE EXCEPTION 'you are the host'; END IF;

  IF _seat_index IS NOT NULL THEN
    IF _seat_index < 2 OR _seat_index > 20 THEN
      RAISE EXCEPTION 'invalid voice seat number';
    END IF;
    IF _seat_index = ANY(r.locked) THEN
      RAISE EXCEPTION 'seat is locked';
    END IF;
    SELECT EXISTS(
      SELECT 1 FROM public.room_members
       WHERE room_id = _room_id AND seat_index = _seat_index
    ) INTO seat_taken;
    IF seat_taken THEN RAISE EXCEPTION 'seat already taken'; END IF;
  END IF;

  SELECT id INTO req_id
    FROM public.seat_requests
   WHERE room_id = _room_id AND from_user = me AND status = 'pending'
   ORDER BY created_at DESC
   LIMIT 1;

  IF req_id IS NOT NULL THEN
    UPDATE public.seat_requests
       SET seat_index = _seat_index, created_at = now()
     WHERE id = req_id;
    RETURN req_id;
  END IF;

  INSERT INTO public.seat_requests (room_id, from_user, seat_index)
  VALUES (_room_id, me, _seat_index)
  RETURNING id INTO req_id;

  RETURN req_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_seat_request(_request_id uuid, _accept boolean)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  req record;
  r record;
  target_seat int;
  i int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO req FROM public.seat_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'request already handled'; END IF;

  SELECT host_id, room_type::text AS room_type, status::text AS status,
         COALESCE(locked_seats, '{}'::int[]) AS locked
    INTO r
    FROM public.live_rooms
   WHERE id = req.room_id;

  IF r.host_id IS NULL THEN RAISE EXCEPTION 'room not found'; END IF;
  IF r.room_type <> 'voice' THEN RAISE EXCEPTION 'not a voice room'; END IF;
  IF r.status <> 'live' THEN RAISE EXCEPTION 'room is not live'; END IF;

  IF NOT (
    me = r.host_id OR EXISTS (
      SELECT 1 FROM public.room_members
       WHERE room_id = req.room_id AND user_id = me AND COALESCE(is_moderator,false)
    )
  ) THEN
    RAISE EXCEPTION 'only host or moderator can respond';
  END IF;

  IF NOT _accept THEN
    UPDATE public.seat_requests
       SET status = 'rejected', responded_at = now(), responded_by = me
     WHERE id = _request_id;
    RETURN -1;
  END IF;

  IF req.seat_index IS NOT NULL THEN
    IF req.seat_index < 2 OR req.seat_index > 20 THEN
      RAISE EXCEPTION 'invalid voice seat number';
    END IF;
    IF req.seat_index = ANY(r.locked) THEN
      RAISE EXCEPTION 'seat is locked';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.room_members
       WHERE room_id = req.room_id AND seat_index = req.seat_index
    ) THEN
      RAISE EXCEPTION 'seat already taken';
    END IF;
    target_seat := req.seat_index;
  ELSE
    FOR i IN 2..20 LOOP
      IF i <> ALL(r.locked)
         AND NOT EXISTS (
           SELECT 1 FROM public.room_members
            WHERE room_id = req.room_id AND seat_index = i
         ) THEN
        target_seat := i;
        EXIT;
      END IF;
    END LOOP;
    IF target_seat IS NULL THEN RAISE EXCEPTION 'no free seat'; END IF;
  END IF;

  UPDATE public.seat_requests
     SET status = 'accepted', responded_at = now(), responded_by = me,
         seat_index = target_seat
   WHERE id = _request_id;

  INSERT INTO public.room_members (room_id, user_id, seat_index, seated_at)
  VALUES (req.room_id, req.from_user, target_seat, now())
  ON CONFLICT (room_id, user_id) DO UPDATE
     SET seat_index = EXCLUDED.seat_index, seated_at = EXCLUDED.seated_at;

  RETURN target_seat;
END;
$$;

-- Host can directly place an existing room viewer on a specific regular seat.
CREATE OR REPLACE FUNCTION public.host_assign_seat(
  _room_id uuid,
  _user_id uuid,
  _seat_index int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  r record;
  occupant uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT host_id, room_type::text AS room_type, status::text AS status,
         COALESCE(locked_seats, '{}'::int[]) AS locked
    INTO r
    FROM public.live_rooms
   WHERE id = _room_id
   FOR UPDATE;

  IF r.host_id IS NULL THEN RAISE EXCEPTION 'room not found'; END IF;
  IF r.host_id <> me THEN RAISE EXCEPTION 'only the host can assign seats'; END IF;
  IF r.room_type <> 'voice' THEN RAISE EXCEPTION 'not a voice room'; END IF;
  IF r.status <> 'live' THEN RAISE EXCEPTION 'room is not live'; END IF;
  IF _seat_index < 2 OR _seat_index > 20 THEN
    RAISE EXCEPTION 'invalid voice seat number';
  END IF;
  IF _seat_index = ANY(r.locked) THEN RAISE EXCEPTION 'seat is locked'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.room_members
     WHERE room_id = _room_id AND user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'user is not a room member';
  END IF;

  SELECT user_id INTO occupant
    FROM public.room_members
   WHERE room_id = _room_id AND seat_index = _seat_index
   FOR UPDATE;

  IF occupant IS NOT NULL AND occupant <> _user_id THEN
    RAISE EXCEPTION 'seat already taken';
  END IF;

  UPDATE public.room_members
     SET seat_index = _seat_index, seated_at = now()
   WHERE room_id = _room_id AND user_id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_seat(uuid,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_seat(uuid,int) TO authenticated;
REVOKE ALL ON FUNCTION public.respond_seat_request(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_seat_request(uuid,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.host_assign_seat(uuid,uuid,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_assign_seat(uuid,uuid,int) TO authenticated;

UPDATE public.live_rooms
   SET seat_count = 20
 WHERE room_type::text = 'voice'
   AND seat_count IS DISTINCT FROM 20;

NOTIFY pgrst, 'reload schema';
COMMIT;
