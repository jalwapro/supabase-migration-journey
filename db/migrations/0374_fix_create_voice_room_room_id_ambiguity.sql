-- Fix PostgreSQL 42702 caused by the PL/pgSQL room_id variable
-- colliding with room_members.room_id / live_rooms.id column references.
CREATE OR REPLACE FUNCTION public.create_voice_room(
  _title text DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _is_locked boolean DEFAULT false,
  _password text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  me uuid := auth.uid();
  v_room_id uuid;
  channel text;
  clean_title text;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT lr.id INTO v_room_id
  FROM public.live_rooms AS lr
  WHERE lr.host_id = me
    AND lr.status = 'live'
  ORDER BY lr.created_at DESC
  LIMIT 1;

  IF v_room_id IS NOT NULL THEN
    RETURN v_room_id;
  END IF;

  clean_title := COALESCE(NULLIF(btrim(_title), ''), 'Voice Room');

  IF length(clean_title) > 120 THEN
    RAISE EXCEPTION 'room title too long';
  END IF;

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
    CASE
      WHEN COALESCE(_is_locked, false) THEN NULLIF(btrim(_password), '')
      ELSE NULL
    END,
    _category_id, ARRAY[1]::integer[], now(), now(), now()
  )
  RETURNING live_rooms.id INTO v_room_id;

  INSERT INTO public.room_members AS rm (room_id, user_id, seat_index, seated_at)
  VALUES (v_room_id, me, 1, now())
  ON CONFLICT (room_id, user_id)
  DO UPDATE SET
    seat_index = EXCLUDED.seat_index,
    seated_at = EXCLUDED.seated_at;

  RETURN v_room_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_voice_room(text,uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_voice_room(text,uuid,boolean,text) TO authenticated;
