CREATE OR REPLACE FUNCTION public.verify_room_pin(_room_id uuid, _pin text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.live_rooms
      WHERE id = _room_id
        AND (is_locked = false OR room_pin = _pin)
    );
$function$;

REVOKE ALL ON FUNCTION public.verify_room_pin(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_room_pin(uuid, text) TO authenticated;
