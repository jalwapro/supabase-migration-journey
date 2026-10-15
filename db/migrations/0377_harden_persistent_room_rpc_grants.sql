-- Keep the persistent-room SECURITY DEFINER functions private to their
-- intended authenticated callers. The reaper is service-role/cron only.
REVOKE ALL ON FUNCTION public.host_room_heartbeat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.host_room_heartbeat(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.leave_room_as_host(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_room_as_host(uuid, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.reclaim_room(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reclaim_room(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_recoverable_room() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_recoverable_room() TO authenticated;

REVOKE ALL ON FUNCTION public.create_voice_room(text, uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_voice_room(text, uuid, boolean, text) TO authenticated;

REVOKE ALL ON FUNCTION public.close_stale_rooms() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_stale_rooms() TO service_role;
