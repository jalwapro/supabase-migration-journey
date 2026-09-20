-- Fix the active send_gift RPC after a later migration replaced the
-- trusted-definer marker. The profiles guard otherwise restores coins/diamonds
-- to their old values, while gift_sends and wallet_transactions still record
-- the gift, making the gift sheet balance appear unchanged.
DO $$
DECLARE
  r record;
  patched text;
BEGIN
  SELECT pg_get_functiondef(p.oid) AS definition
    INTO r
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'send_gift'
    AND p.oid::regprocedure::text = 'send_gift(uuid,uuid,uuid,integer,boolean)';

  IF r.definition IS NULL THEN
    RAISE EXCEPTION 'send_gift 5-arg function not found';
  END IF;

  IF r.definition NOT LIKE '%set_config(''app.trusted_definer'', ''on'', true)%' THEN
    patched := replace(
      r.definition,
      E'BEGIN\n',
      E'BEGIN\n  PERFORM set_config(''app.trusted_definer'', ''on'', true);\n'
    );
    EXECUTE patched;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
