-- Reintroduce safe multi-recipient room gifting after 0372 removed the older
-- send_gift_multi RPC. The wrapper validates seated recipients and delegates
-- each accounting write to the canonical atomic send_gift() function. Any
-- exception rolls the complete statement back, so recipients are all-or-none.

CREATE OR REPLACE FUNCTION public.send_gift_multi_current(
  _room_id uuid,
  _receiver_ids uuid[],
  _gift_id uuid,
  _quantity integer
)
RETURNS SETOF public.gift_sends
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_receiver uuid;
  v_seen uuid[] := ARRAY[]::uuid[];
BEGIN
  IF v_sender IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _room_id IS NULL OR _gift_id IS NULL THEN RAISE EXCEPTION 'Gift parameters are required'; END IF;
  IF _receiver_ids IS NULL OR cardinality(_receiver_ids) < 1 OR cardinality(_receiver_ids) > 20 THEN RAISE EXCEPTION 'Invalid receiver count'; END IF;
  IF _quantity IS NULL OR _quantity < 1 OR _quantity > 100 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;

  FOREACH v_receiver IN ARRAY _receiver_ids LOOP
    IF v_receiver IS NULL OR v_receiver = v_sender THEN
      RAISE EXCEPTION 'Invalid gift receiver';
    END IF;
    IF v_receiver = ANY(v_seen) THEN
      CONTINUE;
    END IF;
    v_seen := array_append(v_seen, v_receiver);

    IF NOT EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = _room_id
        AND rm.user_id = v_receiver
        AND rm.seat_index IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Receiver is not seated in this room';
    END IF;

    RETURN NEXT public.send_gift(_room_id, v_receiver, _gift_id, _quantity, false);
  END LOOP;

  IF cardinality(v_seen) < 1 THEN RAISE EXCEPTION 'Pick a receiver'; END IF;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.send_gift_multi_current(uuid,uuid[],uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_gift_multi_current(uuid,uuid[],uuid,integer) TO authenticated;
