-- JALWA gift economy: receiver gets 25% of gift value in PKR.
-- The payout is calculated server-side from app_settings rates.
-- gifts.diamonds_value is intentionally excluded from payout calculation.

CREATE OR REPLACE FUNCTION public.send_gift(
  _room_id uuid,
  _receiver_id uuid,
  _gift_id uuid,
  _quantity integer,
  _write_message boolean DEFAULT true
)
RETURNS public.gift_sends
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sender uuid := auth.uid();
  g public.gifts%ROWTYPE;
  v_row public.gift_sends;
  v_coins bigint;
  v_diamonds bigint;
  v_sender_coins bigint;
  v_receiver_diamonds bigint;
  v_gift_loop boolean;
  v_gift_audio_volume numeric;
  v_gift_audio_enabled boolean;
  v_gift_render_config jsonb;
  v_coin_price_pkr numeric;
  v_diamond_price_pkr numeric;
BEGIN
  PERFORM set_config('app.trusted_definer', 'on', true);

  IF v_sender IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _quantity IS NULL OR _quantity < 1 OR _quantity > 100 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  IF _room_id IS NULL OR _receiver_id IS NULL OR _gift_id IS NULL THEN RAISE EXCEPTION 'Gift parameters are required'; END IF;
  IF _receiver_id = v_sender THEN RAISE EXCEPTION 'Cannot gift yourself'; END IF;

  SELECT * INTO g
  FROM public.gifts
  WHERE id = _gift_id AND COALESCE(is_active, active, true) = true
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gift not found or inactive'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.live_rooms
    WHERE id = _room_id AND status <> 'ended'
  ) THEN RAISE EXCEPTION 'Room not found or ended'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _receiver_id) THEN
    RAISE EXCEPTION 'Receiver profile not found';
  END IF;

  SELECT loop, audio_volume, audio_enabled, render_config
    INTO v_gift_loop, v_gift_audio_volume, v_gift_audio_enabled, v_gift_render_config
  FROM public.gifts
  WHERE id = _gift_id;

  v_coins := (COALESCE(g.price_coins, g.price, 0)::bigint) * _quantity;
  IF v_coins <= 0 THEN RAISE EXCEPTION 'Gift has no valid coin price'; END IF;

  SELECT coin_price_pkr, diamond_price_pkr
    INTO v_coin_price_pkr, v_diamond_price_pkr
  FROM public.app_settings
  WHERE id = 'global'
  LIMIT 1;

  IF COALESCE(v_coin_price_pkr, 0) <= 0 OR COALESCE(v_diamond_price_pkr, 0) <= 0 THEN
    RAISE EXCEPTION 'Gift economy rates are not configured';
  END IF;

  v_diamonds := round(
    (v_coins::numeric * v_coin_price_pkr * 0.25) / v_diamond_price_pkr
  )::bigint;

  SELECT coins INTO v_sender_coins
  FROM public.profiles
  WHERE id = v_sender
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sender profile not found'; END IF;
  IF COALESCE(v_sender_coins, 0) < v_coins THEN RAISE EXCEPTION 'Insufficient coins'; END IF;

  UPDATE public.profiles
     SET coins = COALESCE(coins, 0) - v_coins,
         updated_at = now()
   WHERE id = v_sender
   RETURNING coins INTO v_sender_coins;

  UPDATE public.profiles
     SET diamonds = COALESCE(diamonds, 0) + v_diamonds,
         updated_at = now()
   WHERE id = _receiver_id
   RETURNING diamonds INTO v_receiver_diamonds;

  INSERT INTO public.gift_sends (
    room_id, sender_id, receiver_id, gift_id, quantity, coins_spent, diamonds_earned,
    created_at, finalized_at, gift_name, gift_emoji, gift_icon, gift_animation,
    gift_clip_path, gift_clip_type, gift_image_url, gift_sound_url, gift_audio_url,
    gift_priority, gift_duration_ms, gift_loop, gift_audio_volume, gift_audio_enabled,
    gift_render_config
  ) VALUES (
    _room_id, v_sender, _receiver_id, _gift_id, _quantity, v_coins, v_diamonds,
    now(), now(), g.name, g.emoji, g.icon, g.animation, g.clip_path, g.clip_type,
    g.image_url, g.sound_url, g.audio_url, g.priority, g.duration_ms,
    v_gift_loop, v_gift_audio_volume, v_gift_audio_enabled, v_gift_render_config
  ) RETURNING * INTO v_row;

  INSERT INTO public.wallet_transactions
    (user_id, kind, coins_delta, diamonds_delta, balance_coins_after, ref_type, ref_id, note)
  VALUES
    (v_sender, 'gift_sent', -v_coins, 0, v_sender_coins, 'gift', v_row.id,
     'Sent ' || COALESCE(g.name, 'gift'));

  IF v_diamonds > 0 THEN
    INSERT INTO public.wallet_transactions
      (user_id, kind, coins_delta, diamonds_delta, ref_type, ref_id, note)
    VALUES
      (_receiver_id, 'gift_received', 0, v_diamonds, 'gift', v_row.id,
       'Received ' || COALESCE(g.name, 'gift'));
  END IF;

  RETURN v_row;
END;
$function$;
