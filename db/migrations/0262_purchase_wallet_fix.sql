-- 0262: Fix entrance/profile-card purchases.
-- Both RPCs debited a non-existent `public.wallets` table and used a
-- wallet_transactions column shape that does not exist, so every purchase
-- failed. Source of truth for balances is public.profiles (coins/diamonds),
-- matching purchase_shop_item.

CREATE OR REPLACE FUNCTION public.purchase_entrance_effect(_effect_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _eff record;
  _bal bigint;
  _user_level int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT * INTO _eff FROM public.entrance_effects WHERE id = _effect_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'EFFECT_NOT_FOUND'; END IF;

  IF _eff.is_limited AND _eff.ends_at IS NOT NULL AND now() > _eff.ends_at THEN
    RAISE EXCEPTION 'EFFECT_EXPIRED';
  END IF;

  SELECT COALESCE(vip_level, 0) INTO _user_level FROM public.profiles WHERE id = _uid;
  IF _user_level < _eff.min_vip_level THEN
    RAISE EXCEPTION 'VIP_LEVEL_REQUIRED:%', _eff.min_vip_level;
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_entrance_effects WHERE user_id = _uid AND effect_id = _effect_id) THEN
    RAISE EXCEPTION 'ALREADY_OWNED';
  END IF;

  IF _eff.price_coins > 0 THEN
    UPDATE public.profiles
       SET coins = coins - _eff.price_coins, updated_at = now()
     WHERE id = _uid AND coins >= _eff.price_coins
     RETURNING coins INTO _bal;
    IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_COINS'; END IF;

    INSERT INTO public.wallet_transactions (user_id, kind, coins_delta, ref_type, ref_id, note)
    VALUES (_uid, 'entrance_purchase', -_eff.price_coins, 'entrance_effect', _eff.id, 'Bought ' || _eff.name);
  ELSE
    SELECT coins INTO _bal FROM public.profiles WHERE id = _uid;
  END IF;

  INSERT INTO public.user_entrance_effects (user_id, effect_id, expires_at)
  VALUES (_uid, _effect_id, CASE WHEN _eff.is_limited THEN _eff.ends_at ELSE NULL END);

  INSERT INTO public.entrance_purchases (user_id, effect_id, price_coins)
  VALUES (_uid, _effect_id, _eff.price_coins);

  RETURN jsonb_build_object('ok', true, 'balance', COALESCE(_bal, 0));
END $$;

REVOKE ALL ON FUNCTION public.purchase_entrance_effect(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.purchase_entrance_effect(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.purchase_profile_card(_card_id uuid, _currency text DEFAULT 'coins')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _c record;
  _bal bigint;
  _user_level int;
  _price bigint;
  _expires timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _currency NOT IN ('coins','diamonds') THEN RAISE EXCEPTION 'INVALID_CURRENCY'; END IF;

  SELECT * INTO _c FROM public.profile_cards WHERE id = _card_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'CARD_NOT_FOUND'; END IF;

  IF _c.is_limited AND _c.ends_at IS NOT NULL AND now() > _c.ends_at THEN
    RAISE EXCEPTION 'CARD_EXPIRED';
  END IF;

  SELECT COALESCE(vip_level, 0) INTO _user_level FROM public.profiles WHERE id = _uid;
  IF _user_level < _c.min_vip_level THEN
    RAISE EXCEPTION 'VIP_LEVEL_REQUIRED:%', _c.min_vip_level;
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_profile_cards WHERE user_id = _uid AND card_id = _card_id
             AND (expires_at IS NULL OR expires_at > now())) THEN
    RAISE EXCEPTION 'ALREADY_OWNED';
  END IF;

  _price := CASE WHEN _currency = 'diamonds' THEN _c.price_diamonds ELSE _c.price_coins END;
  IF _price < 0 THEN RAISE EXCEPTION 'INVALID_PRICE'; END IF;

  IF _price > 0 THEN
    IF _currency = 'diamonds' THEN
      UPDATE public.profiles SET diamonds = diamonds - _price, updated_at = now()
        WHERE id = _uid AND diamonds >= _price RETURNING diamonds INTO _bal;
      IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_DIAMONDS'; END IF;
      INSERT INTO public.wallet_transactions (user_id, kind, diamonds_delta, ref_type, ref_id, note)
      VALUES (_uid, 'profile_card_purchase', -_price, 'profile_card', _c.id, 'Bought ' || _c.name);
    ELSE
      UPDATE public.profiles SET coins = coins - _price, updated_at = now()
        WHERE id = _uid AND coins >= _price RETURNING coins INTO _bal;
      IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_COINS'; END IF;
      INSERT INTO public.wallet_transactions (user_id, kind, coins_delta, ref_type, ref_id, note)
      VALUES (_uid, 'profile_card_purchase', -_price, 'profile_card', _c.id, 'Bought ' || _c.name);
    END IF;
  ELSE
    SELECT CASE WHEN _currency = 'diamonds' THEN diamonds ELSE coins END
      INTO _bal FROM public.profiles WHERE id = _uid;
  END IF;

  IF _c.duration_days IS NOT NULL AND _c.duration_days > 0 THEN
    _expires := now() + (_c.duration_days || ' days')::interval;
  ELSE
    _expires := NULL;
  END IF;

  INSERT INTO public.user_profile_cards (user_id, card_id, expires_at)
  VALUES (_uid, _card_id, _expires)
  ON CONFLICT (user_id, card_id) DO UPDATE
    SET expires_at = CASE
      WHEN public.user_profile_cards.expires_at IS NULL THEN NULL
      WHEN excluded.expires_at IS NULL THEN NULL
      ELSE greatest(public.user_profile_cards.expires_at, now()) + (_c.duration_days || ' days')::interval
    END,
        purchased_at = now();

  INSERT INTO public.profile_card_purchases (user_id, card_id, currency, amount)
  VALUES (_uid, _card_id, _currency, _price);

  RETURN jsonb_build_object('ok', true, 'balance', COALESCE(_bal, 0));
END $$;

REVOKE ALL ON FUNCTION public.purchase_profile_card(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.purchase_profile_card(uuid, text) TO authenticated;
