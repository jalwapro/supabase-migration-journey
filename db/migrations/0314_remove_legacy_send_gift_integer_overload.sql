BEGIN;

-- PostgREST RPC uses the room-aware 5-argument send_gift exclusively.
-- Remove the old 3-argument overload so the public RPC has one canonical
-- signature and cannot be mis-resolved by stale/generated clients.
DROP FUNCTION IF EXISTS public.send_gift(uuid, integer, uuid);

GRANT EXECUTE ON FUNCTION public.send_gift(uuid, uuid, uuid, integer, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
