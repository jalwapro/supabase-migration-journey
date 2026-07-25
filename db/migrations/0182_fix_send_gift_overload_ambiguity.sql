-- Fix PostgREST "could not choose the best candidate function" for send_gift.
-- Both send_gift(4 args) and send_gift(5 args, last default) matched the same
-- named-argument call from GiftSheet. Drop the 4-arg overload; the 5-arg
-- version is a strict superset (defaults _write_message = true).
BEGIN;
DROP FUNCTION IF EXISTS public.send_gift(uuid, uuid, uuid, integer);
COMMIT;
