-- Repair: send_gift RPC writes to wallet_transactions columns that don't exist
-- (ref_type, ref_id, balance_coins_after). Add them as nullable so both the
-- current 2-arg + legacy code paths keep working. Also normalise send_room_gift
-- to look up rooms in public.live_rooms (the actual live rooms table) instead
-- of the empty public.rooms, so any future call site works.

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS ref_type text,
  ADD COLUMN IF NOT EXISTS ref_id uuid,
  ADD COLUMN IF NOT EXISTS balance_coins_after bigint;

CREATE INDEX IF NOT EXISTS wallet_transactions_ref_idx
  ON public.wallet_transactions (ref_type, ref_id);

-- Rewrite send_room_gift variants to query live_rooms instead of rooms.
-- Idempotent: DROP + CREATE for each overload.

DROP FUNCTION IF EXISTS public.send_room_gift(uuid, text, text, integer, text);
DROP FUNCTION IF EXISTS public.send_room_gift(uuid, text, text, integer, text, uuid);
DROP FUNCTION IF EXISTS public.send_room_gift(uuid, text, text, integer, text, uuid, uuid);

CREATE OR REPLACE FUNCTION public.send_room_gift(
  _room_id uuid,
  _emoji   text,
  _name    text,
  _price   integer,
  _target  text,
  _target_id uuid DEFAULT NULL,
  _gift_id   uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender uuid := auth.uid();
  host   uuid;
  new_coins bigint;
  diamonds_earned bigint;
  host_share numeric := 0.6;
  economy jsonb;
BEGIN
  IF sender IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _price < 0 THEN RAISE EXCEPTION 'invalid price'; END IF;

  SELECT host_id INTO host FROM public.live_rooms WHERE id = _room_id;
  IF host IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;

  SELECT value INTO economy FROM public.app_settings WHERE key = 'economy';
  IF economy ? 'hostGiftShare' THEN
    host_share := (economy->>'hostGiftShare')::numeric;
  END IF;
  diamonds_earned := floor(_price * host_share);

  UPDATE public.profiles
     SET coins = coins - _price
   WHERE id = sender AND coins >= _price
   RETURNING coins INTO new_coins;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient coins'; END IF;

  UPDATE public.profiles
     SET diamonds = diamonds + diamonds_earned
   WHERE id = COALESCE(_target_id, host);

  INSERT INTO public.wallet_transactions
    (user_id, kind, coins_delta, balance_coins_after, ref_type, ref_id, note)
  VALUES
    (sender, 'gift_sent', -_price, new_coins, 'room_gift', _room_id,
     'Sent ' || _name || COALESCE(' ' || _emoji, ''));

  INSERT INTO public.wallet_transactions
    (user_id, kind, diamonds_delta, ref_type, ref_id, note)
  VALUES
    (COALESCE(_target_id, host), 'gift_received', diamonds_earned, 'room_gift', _room_id,
     'Received ' || _name || COALESCE(' ' || _emoji, ''));

  INSERT INTO public.room_messages (room_id, user_id, kind, text, meta)
  VALUES (_room_id, sender, 'gift', _name,
    jsonb_build_object(
      'giftId', _gift_id, 'giftName', _name, 'icon', _emoji,
      'quantity', 1, 'coins', _price,
      'receiverId', COALESCE(_target_id, host)
    ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_room_gift(uuid, text, text, integer, text, uuid, uuid) TO authenticated, service_role;
