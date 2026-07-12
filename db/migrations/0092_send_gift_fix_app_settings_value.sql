-- Repair: migration 0085 re-introduced `SELECT value FROM app_settings` inside
-- send_gift. That column does not exist on the singleton app_settings table
-- (it uses typed columns), so every gift send fails with:
--   column "value" does not exist
-- Drop the lookup and use a constant host share (0.6), matching 0037's fix,
-- while keeping bigint numeric types from 0085.

DROP FUNCTION IF EXISTS public.send_gift(uuid, uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.send_gift(uuid, uuid, uuid, int);

CREATE OR REPLACE FUNCTION public.send_gift(
  _room_id uuid, _receiver_id uuid, _gift_id uuid, _quantity int DEFAULT 1
) RETURNS public.gift_sends
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sender uuid := auth.uid();
  g public.gifts%ROWTYPE;
  host_share constant numeric := 0.6;
  total_coins bigint;
  diamonds_earned bigint;
  new_sender_coins bigint;
  send_row public.gift_sends;
BEGIN
  IF sender IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF _quantity IS NULL OR _quantity < 1 THEN _quantity := 1; END IF;
  IF _receiver_id = sender THEN RAISE EXCEPTION 'cannot gift yourself'; END IF;

  SELECT * INTO g FROM public.gifts WHERE id = _gift_id AND COALESCE(active, is_active);
  IF NOT FOUND THEN RAISE EXCEPTION 'gift not found'; END IF;

  total_coins := COALESCE(g.price_coins, g.price)::bigint * _quantity;
  diamonds_earned := floor(total_coins * host_share)::bigint
                     + (COALESCE(g.diamonds_value, 0)::bigint * _quantity);

  UPDATE public.profiles
     SET coins = coins - total_coins
   WHERE id = sender AND coins >= total_coins
   RETURNING coins INTO new_sender_coins;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient coins'; END IF;

  UPDATE public.profiles
     SET diamonds = diamonds + diamonds_earned
   WHERE id = _receiver_id;

  INSERT INTO public.gift_sends
    (room_id, sender_id, receiver_id, gift_id, quantity, coins_spent, diamonds_earned)
  VALUES
    (_room_id, sender, _receiver_id, _gift_id, _quantity, total_coins, diamonds_earned)
  RETURNING * INTO send_row;

  INSERT INTO public.wallet_transactions
    (user_id, kind, coins_delta, balance_coins_after, ref_type, ref_id, note)
  VALUES
    (sender, 'gift_sent', -total_coins, new_sender_coins, 'gift', send_row.id,
     'Sent ' || _quantity || 'x ' || g.name);

  INSERT INTO public.wallet_transactions
    (user_id, kind, diamonds_delta, ref_type, ref_id, note)
  VALUES
    (_receiver_id, 'gift_received', diamonds_earned, 'gift', send_row.id,
     'Received ' || _quantity || 'x ' || g.name);

  IF _room_id IS NOT NULL THEN
    INSERT INTO public.room_messages (room_id, user_id, kind, text, message, meta)
    VALUES (_room_id, sender, 'gift', g.name, g.name,
      jsonb_build_object(
        'giftId', g.id, 'giftName', g.name, 'icon', COALESCE(g.icon, g.emoji),
        'quantity', _quantity, 'coins', total_coins,
        'receiverId', _receiver_id, 'animation', g.animation
      ));
  END IF;

  RETURN send_row;
END $$;

GRANT EXECUTE ON FUNCTION public.send_gift(uuid, uuid, uuid, integer) TO authenticated;
