-- 0378: explicit host seat claiming and one active voice seat per user.
-- Room creation must not seat the owner automatically. The owner joins as a
-- viewer and claims Seat 1 by tapping the host card inside the room.

BEGIN;

-- Remove implicit host seating from existing live voice rooms. Hosts can
-- claim Seat 1 explicitly after entering the room.
UPDATE public.room_members AS rm
   SET seat_index = NULL,
       seated_at = NULL
  FROM public.live_rooms AS lr
 WHERE lr.id = rm.room_id
   AND lr.room_type::text = 'voice'
   AND lr.status::text IN ('live', 'host_disconnected')
   AND rm.user_id = lr.host_id
   AND rm.seat_index = 1;

-- Guard all writes to voice seats, not only take_seat RPC calls. The per-user
-- advisory lock makes simultaneous attempts in two different rooms serialize.
CREATE OR REPLACE FUNCTION public.guard_single_active_voice_seat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_type text;
BEGIN
  IF NEW.seat_index IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT lr.room_type::text
    INTO target_type
    FROM public.live_rooms AS lr
   WHERE lr.id = NEW.room_id;

  IF target_type IS DISTINCT FROM 'voice' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('jalwa:voice-seat:' || NEW.user_id::text, 0)
  );

  IF EXISTS (
    SELECT 1
      FROM public.room_members AS other_member
      JOIN public.live_rooms AS other_room
        ON other_room.id = other_member.room_id
     WHERE other_member.user_id = NEW.user_id
       AND other_member.room_id <> NEW.room_id
       AND other_member.seat_index IS NOT NULL
       AND other_room.room_type::text = 'voice'
       AND other_room.status::text IN ('live', 'host_disconnected')
  ) THEN
    RAISE EXCEPTION 'You already occupy a seat in another room. Leave that seat first.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_single_active_voice_seat ON public.room_members;
CREATE TRIGGER trg_guard_single_active_voice_seat
BEFORE INSERT OR UPDATE OF seat_index ON public.room_members
FOR EACH ROW
EXECUTE FUNCTION public.guard_single_active_voice_seat();

-- Override the room creator RPC so creating/reopening a room does not place
-- the host on Seat 1. The route adds a null-seat membership when the host
-- actually enters the room.
CREATE OR REPLACE FUNCTION public.create_voice_room(
  _title text DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _is_locked boolean DEFAULT false,
  _password text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  v_room_id uuid;
  channel text;
  clean_title text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT lr.id INTO v_room_id
    FROM public.live_rooms AS lr
   WHERE lr.host_id = me
     AND lr.status IN ('live', 'host_disconnected')
   ORDER BY lr.created_at DESC
   LIMIT 1;

  IF v_room_id IS NOT NULL THEN
    UPDATE public.live_rooms
       SET status = 'live'::room_status,
           heartbeat_at = now(),
           host_last_seen_at = now(),
           grace_period_until = NULL
     WHERE id = v_room_id;
    RETURN v_room_id;
  END IF;

  clean_title := COALESCE(NULLIF(btrim(_title), ''), 'Voice Room');
  IF length(clean_title) > 120 THEN RAISE EXCEPTION 'room title too long'; END IF;
  IF COALESCE(_is_locked, false)
     AND NULLIF(btrim(_password), '') IS NULL THEN
    RAISE EXCEPTION 'password required for private room';
  END IF;

  channel := 'jalwa-' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.live_rooms (
    host_id, title, room_type, status, rtc_channel,
    seat_count, viewer_count, pk_battle, is_locked, password,
    category_id, locked_seats, heartbeat_at, host_last_seen_at, updated_at
  )
  VALUES (
    me, clean_title, 'voice', 'live', channel,
    20, 0, false, COALESCE(_is_locked, false),
    CASE WHEN COALESCE(_is_locked, false) THEN NULLIF(btrim(_password), '') ELSE NULL END,
    _category_id, ARRAY[1]::integer[], now(), now(), now()
  )
  RETURNING id INTO v_room_id;

  RETURN v_room_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_voice_room(text,uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_voice_room(text,uuid,boolean,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
