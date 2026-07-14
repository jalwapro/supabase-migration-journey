-- Scale fix: combo gift storm.
-- Before: 50 taps × N receivers = 50N send_gift calls, each writing a
-- room_messages row → 50N realtime broadcasts to every viewer in the room.
-- After: taps skip the message insert; one summary row is written per
-- receiver when the combo timer expires.
--
-- Change: add `_write_message boolean default true` to send_gift so existing
-- callers keep behaviour, and add `log_combo_gift_summary` RPC for the
-- end-of-combo summary write (no coin move, no wallet entries — those
-- already happened during the taps).

DROP FUNCTION IF EXISTS public.send_gift(uuid, uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.send_gift(uuid, uuid, uuid, int);
DROP FUNCTION IF EXISTS public.send_gift(uuid, uuid, uuid, integer, boolean);

CREATE OR REPLACE FUNCTION public.send_gift(
  _room_id uuid,
  _receiver_id uuid,
  _gift_id uuid,
  _quantity int DEFAULT 1,
  _write_message boolean DEFAULT true
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

  IF _room_id IS NOT NULL AND _write_message THEN
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

GRANT EXECUTE ON FUNCTION public.send_gift(uuid, uuid, uuid, integer, boolean) TO authenticated;

-- Combo summary: one message per receiver at combo end. No economy side
-- effects — coins and wallet rows were written by the individual taps.
CREATE OR REPLACE FUNCTION public.log_combo_gift_summary(
  _room_id uuid,
  _receiver_id uuid,
  _gift_id uuid,
  _total_quantity int
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sender uuid := auth.uid();
  g public.gifts%ROWTYPE;
  total_coins bigint;
BEGIN
  IF sender IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF _total_quantity IS NULL OR _total_quantity < 1 THEN RETURN; END IF;
  IF _room_id IS NULL THEN RETURN; END IF;

  SELECT * INTO g FROM public.gifts WHERE id = _gift_id;
  IF NOT FOUND THEN RETURN; END IF;

  total_coins := COALESCE(g.price_coins, g.price)::bigint * _total_quantity;

  INSERT INTO public.room_messages (room_id, user_id, kind, text, message, meta)
  VALUES (_room_id, sender, 'gift', g.name, g.name,
    jsonb_build_object(
      'giftId', g.id, 'giftName', g.name, 'icon', COALESCE(g.icon, g.emoji),
      'quantity', _total_quantity, 'coins', total_coins,
      'receiverId', _receiver_id, 'animation', g.animation,
      'combo', true
    ));
END $$;

GRANT EXECUTE ON FUNCTION public.log_combo_gift_summary(uuid, uuid, uuid, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
