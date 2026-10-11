-- Allow intentional self-gifting without replacing the current gift accounting logic.
-- Patch only the self-recipient guards in the deployed function definitions so
-- coin cost-basis deductions, diamond payout rules, ledger writes, and gift snapshots remain intact.
BEGIN;

DO $self_gifting$
DECLARE
  v_definition text;
  v_patched text;
BEGIN
  SELECT pg_get_functiondef(
    'public.send_gift(uuid,uuid,uuid,integer,boolean)'::regprocedure
  ) INTO v_definition;

  IF position(
    'if _receiver_id=v_sender then raise exception ''Cannot gift yourself''; end if;'
    IN v_definition
  ) = 0 THEN
    RAISE EXCEPTION 'Expected send_gift self-gifting guard was not found; aborting without changing the function';
  END IF;

  v_patched := replace(
    v_definition,
    'if _receiver_id=v_sender then raise exception ''Cannot gift yourself''; end if;',
    ''
  );
  EXECUTE v_patched;

  SELECT pg_get_functiondef(
    'public.send_gift_multi_current(uuid,uuid[],uuid,integer)'::regprocedure
  ) INTO v_definition;

  IF position(
    'if v_receiver is null or v_receiver = v_sender then'
    IN v_definition
  ) = 0 THEN
    RAISE EXCEPTION 'Expected multi-gift self-gifting guard was not found; aborting without changing the function';
  END IF;

  v_patched := replace(
    v_definition,
    'if v_receiver is null or v_receiver = v_sender then',
    'if v_receiver is null then'
  );
  EXECUTE v_patched;
END;
$self_gifting$;

NOTIFY pgrst, 'reload schema';
COMMIT;
