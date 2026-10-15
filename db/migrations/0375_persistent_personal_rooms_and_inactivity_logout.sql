-- 0375: persistent personal voice rooms and seven-day inactivity logout.
-- Rooms stay live while their owner is signed in, including when the owner
-- minimizes the room or temporarily closes the app. Explicit logout or seven
-- days without app activity ends the owner's rooms.

CREATE OR REPLACE FUNCTION public.host_room_heartbeat(_room_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  new_status text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  UPDATE public.live_rooms
     SET heartbeat_at = now(),
         host_last_seen_at = now(),
         status = 'live'::room_status,
         grace_period_until = NULL
   WHERE id = _room_id
     AND host_id = me
     AND status IN ('live', 'host_disconnected')
  RETURNING status::text INTO new_status;

  RETURN COALESCE(new_status, 'not_found');
END;
$$;
GRANT EXECUTE ON FUNCTION public.host_room_heartbeat(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_room_as_host(_room_id uuid, _end_now boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  is_owner boolean;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.live_rooms
    WHERE id = _room_id AND host_id = me
  ) INTO is_owner;
  IF NOT is_owner THEN RAISE EXCEPTION 'not room host'; END IF;

  IF COALESCE(_end_now, false) THEN
    PERFORM public.finalize_room_gifts(_room_id);
    UPDATE public.live_rooms
       SET status = 'ended',
           ended_at = now(),
           grace_period_until = NULL
     WHERE id = _room_id AND status <> 'ended';
    RETURN 'ended';
  END IF;

  -- Leaving/minimizing is not ending the room. It remains discoverable until
  -- the owner explicitly logs out or their seven-day inactivity expires.
  UPDATE public.live_rooms
     SET status = 'live'::room_status,
         heartbeat_at = now(),
         host_last_seen_at = now(),
         grace_period_until = NULL
   WHERE id = _room_id AND status <> 'ended';
  RETURN 'live';
END;
$$;
GRANT EXECUTE ON FUNCTION public.leave_room_as_host(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.reclaim_room(_room_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  ok boolean;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  UPDATE public.live_rooms
     SET status = 'live'::room_status,
         heartbeat_at = now(),
         host_last_seen_at = now(),
         grace_period_until = NULL
   WHERE id = _room_id
     AND host_id = me
     AND status IN ('live', 'host_disconnected')
  RETURNING true INTO ok;

  IF NOT COALESCE(ok, false) THEN
    RAISE EXCEPTION 'room not found or already ended';
  END IF;
  RETURN 'live';
END;
$$;
GRANT EXECUTE ON FUNCTION public.reclaim_room(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_recoverable_room()
RETURNS TABLE (
  id uuid,
  title text,
  cover_url text,
  room_type text,
  status text,
  grace_period_until timestamptz,
  viewer_count int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.title, r.cover_url, r.room_type::text, r.status::text,
         r.grace_period_until, r.viewer_count
    FROM public.live_rooms AS r
   WHERE r.host_id = auth.uid()
     AND r.status IN ('live', 'host_disconnected')
   ORDER BY r.created_at DESC
   LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_my_recoverable_room() TO authenticated;

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
    INSERT INTO public.room_members AS rm (room_id, user_id, seat_index, seated_at)
    VALUES (v_room_id, me, 1, now())
    ON CONFLICT (room_id, user_id)
    DO UPDATE SET seat_index = 1, seated_at = now();
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

  INSERT INTO public.room_members AS rm (room_id, user_id, seat_index, seated_at)
  VALUES (v_room_id, me, 1, now())
  ON CONFLICT (room_id, user_id)
  DO UPDATE SET seat_index = 1, seated_at = now();

  RETURN v_room_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_voice_room(text,uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_voice_room(text,uuid,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_stale_rooms()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  restored integer := 0;
  ended_count integer := 0;
  r record;
BEGIN
  -- Legacy rooms may still be host_disconnected from the old 20-minute grace
  -- system. Restore those while the owner has been active in the last 7 days.
  WITH restored_rows AS (
    UPDATE public.live_rooms AS lr
       SET status = 'live'::room_status,
           grace_period_until = NULL
      FROM public.profiles AS p
     WHERE p.id = lr.host_id
       AND lr.status = 'host_disconnected'
       AND COALESCE(p.last_seen, lr.host_last_seen_at, lr.created_at) >= now() - interval '7 days'
    RETURNING lr.id
  )
  SELECT count(*) INTO restored FROM restored_rows;

  -- Do not end rooms because a mobile app was backgrounded or closed.
  -- Only reap a room when its owner has been inactive for seven days.
  FOR r IN
    SELECT lr.id
      FROM public.live_rooms AS lr
      JOIN public.profiles AS p ON p.id = lr.host_id
     WHERE lr.status IN ('live', 'host_disconnected')
       AND COALESCE(p.last_seen, lr.host_last_seen_at, lr.created_at) < now() - interval '7 days'
  LOOP
    BEGIN
      PERFORM public.finalize_room_gifts(r.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'finalize_room_gifts failed for %: %', r.id, SQLERRM;
    END;
    UPDATE public.live_rooms
       SET status = 'ended',
           ended_at = now(),
           grace_period_until = NULL
     WHERE id = r.id
       AND status <> 'ended';
    ended_count := ended_count + 1;
  END LOOP;

  RETURN restored + ended_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.close_stale_rooms() TO service_role;

NOTIFY pgrst, 'reload schema';
