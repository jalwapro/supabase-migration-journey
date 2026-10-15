-- 0379: Host-controlled open seats or approval-required seats.
-- Seat Open: any room member can take a free, unlocked seat.
-- Seat Lock: regular members must submit a seat request; host/authorized
-- moderators can approve while present. Host Seat 1 remains host-only.

BEGIN;

ALTER TABLE public.live_rooms
  ADD COLUMN IF NOT EXISTS seat_approval_required boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.host_set_seat_approval_mode(
  _room_id uuid,
  _required boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  r_host uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT host_id INTO r_host
    FROM public.live_rooms
   WHERE id = _room_id
     AND room_type::text = 'voice'
   FOR UPDATE;

  IF r_host IS NULL THEN RAISE EXCEPTION 'voice room not found'; END IF;
  IF r_host <> me THEN RAISE EXCEPTION 'only the room host can change seat mode'; END IF;

  UPDATE public.live_rooms
     SET seat_approval_required = COALESCE(_required, false),
         updated_at = now()
   WHERE id = _room_id;

  RETURN COALESCE(_required, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.take_seat(_room_id uuid, _seat_index integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  r record;
  occupant uuid;
  am_mod boolean := false;
  member_exists boolean;
  current_seat integer;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public._room_seat_lock(_room_id);

  SELECT host_id,
         status::text AS status,
         room_type::text AS room_type,
         COALESCE(locked_seats, '{}'::integer[]) AS locked,
         COALESCE(seat_count, 20) AS seat_count,
         COALESCE(seat_approval_required, false) AS seat_approval_required
    INTO r
    FROM public.live_rooms
   WHERE id = _room_id
   FOR UPDATE;

  IF r.host_id IS NULL THEN RAISE EXCEPTION 'room not found'; END IF;
  IF r.status NOT IN ('live', 'host_disconnected') THEN RAISE EXCEPTION 'room is not live'; END IF;
  IF r.room_type <> 'voice' THEN RAISE EXCEPTION 'not a voice room'; END IF;
  IF _seat_index < 1 OR _seat_index > LEAST(20, r.seat_count) THEN
    RAISE EXCEPTION 'invalid voice seat number';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.room_members
     WHERE room_id = _room_id AND user_id = me
  ), max(seat_index)
    INTO member_exists, current_seat
    FROM public.room_members
   WHERE room_id = _room_id AND user_id = me;

  IF NOT member_exists THEN RAISE EXCEPTION 'Join the room before taking a seat'; END IF;

  IF _seat_index = 1 AND me <> r.host_id THEN
    RAISE EXCEPTION 'Only room owner can occupy the host seat';
  END IF;

  SELECT COALESCE(is_moderator, false)
    INTO am_mod
    FROM public.room_members
   WHERE room_id = _room_id AND user_id = me;

  IF _seat_index = ANY(r.locked) AND me <> r.host_id AND NOT COALESCE(am_mod, false) THEN
    RAISE EXCEPTION 'Seat is locked';
  END IF;

  -- Approval is enforced by the database, not only by the client UI.
  -- Already seated users can move seats; a viewer cannot self-seat when locked.
  IF r.seat_approval_required
     AND me <> r.host_id
     AND NOT COALESCE(am_mod, false)
     AND current_seat IS NULL THEN
    RAISE EXCEPTION 'Seat approval required — request a seat first';
  END IF;

  SELECT user_id INTO occupant
    FROM public.room_members
   WHERE room_id = _room_id AND seat_index = _seat_index
   FOR UPDATE;

  IF occupant IS NOT NULL AND occupant <> me THEN
    RAISE EXCEPTION 'Seat is already occupied';
  END IF;

  UPDATE public.room_members
     SET seat_index = _seat_index,
         seated_at = now()
   WHERE room_id = _room_id AND user_id = me;

  IF NOT FOUND THEN RAISE EXCEPTION 'Join the room before taking a seat'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.host_set_seat_approval_mode(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.host_set_seat_approval_mode(uuid, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.take_seat(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.take_seat(uuid, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
