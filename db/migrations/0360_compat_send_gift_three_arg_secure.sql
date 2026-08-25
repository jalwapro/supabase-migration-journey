BEGIN;

-- Backward-compatible bridge for older clients that still call:
-- public.send_gift(_gift_id, _quantity, _receiver_id)
-- The old overload was removed because it had no explicit room context.
-- Reintroduce it only as a SECURITY DEFINER bridge that derives a room from
-- the current user's and receiver's shared room membership. It never trusts
-- a client-supplied sender or room and delegates to the canonical 5-arg RPC.
CREATE OR REPLACE FUNCTION public.send_gift(
  _gift_id uuid,
  _quantity integer,
  _receiver_id uuid
)
RETURNS public.gift_sends
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _room_id uuid;
  _row public.gift_sends;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _gift_id IS NULL OR _receiver_id IS NULL THEN
    RAISE EXCEPTION 'gift and receiver are required';
  END IF;
  IF _quantity IS NULL OR _quantity < 1 THEN
    RAISE EXCEPTION 'invalid quantity';
  END IF;
  IF _receiver_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot send gift to yourself';
  END IF;

  SELECT rm_sender.room_id
    INTO _room_id
  FROM public.room_members rm_sender
  JOIN public.room_members rm_receiver
    ON rm_receiver.room_id = rm_sender.room_id
   AND rm_receiver.user_id = _receiver_id
  WHERE rm_sender.user_id = auth.uid()
  ORDER BY GREATEST(rm_sender.joined_at, rm_receiver.joined_at) DESC NULLS LAST
  LIMIT 1;

  IF _room_id IS NULL THEN
    RAISE EXCEPTION 'sender and receiver are not in a common room';
  END IF;

  SELECT * INTO _row
  FROM public.send_gift(_room_id, _receiver_id, _gift_id, _quantity, true);

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.send_gift(uuid, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_gift(uuid, integer, uuid) TO authenticated;

COMMIT;
