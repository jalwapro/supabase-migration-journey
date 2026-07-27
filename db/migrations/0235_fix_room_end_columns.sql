-- room_end referenced dropped columns is_live/viewers on live_rooms.
-- Align with current schema (status enum + ended_at).
CREATE OR REPLACE FUNCTION public.room_end(_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _host uuid;
BEGIN
  SELECT host_id INTO _host FROM public.live_rooms WHERE id = _room_id;
  IF _host IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF auth.uid() <> _host THEN RAISE EXCEPTION 'Only the host can end the room'; END IF;

  UPDATE public.live_rooms
     SET status = 'ended', ended_at = now()
   WHERE id = _room_id
     AND status <> 'ended';

  DELETE FROM public.room_participants WHERE room_id = _room_id;
END;
$$;
