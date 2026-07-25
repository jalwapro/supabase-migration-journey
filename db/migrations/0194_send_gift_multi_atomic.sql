-- 0194: Atomic multi-receiver gift send. Iterates public.send_gift inside a
-- single SECURITY DEFINER transaction so partial failures roll the whole
-- batch back (no half-charged senders, no half-credited receivers).

BEGIN;

CREATE OR REPLACE FUNCTION public.send_gift_multi(
  _room_id uuid,
  _receiver_ids uuid[],
  _gift_id uuid,
  _quantity integer DEFAULT 1
)
RETURNS SETOF public.gift_sends
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rid uuid;
  row public.gift_sends;
BEGIN
  IF _receiver_ids IS NULL OR array_length(_receiver_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'no receivers';
  END IF;
  IF _quantity IS NULL OR _quantity < 1 THEN
    RAISE EXCEPTION 'invalid quantity';
  END IF;

  FOREACH rid IN ARRAY _receiver_ids LOOP
    SELECT * INTO row FROM public.send_gift(_room_id, rid, _gift_id, _quantity, true);
    RETURN NEXT row;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_gift_multi(uuid, uuid[], uuid, integer) TO authenticated;

COMMIT;
