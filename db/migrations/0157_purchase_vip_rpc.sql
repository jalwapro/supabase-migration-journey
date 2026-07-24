-- C2: Server-side VIP purchase RPC
-- Atomic: validates balance, deducts coins, sets is_vip + expiry, logs transaction.
-- The profiles guard trigger reverts privileged columns even for SECURITY DEFINER
-- functions (because auth.uid() is still the caller), so we teach it to honor a
-- session-scoped trusted marker set by trusted RPCs like purchase_vip.

CREATE OR REPLACE FUNCTION public.profiles_guard_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_caller boolean;
  trusted text := current_setting('app.trusted_definer', true);
BEGIN
  -- Trusted server-side RPC marker (set via set_config in SECURITY DEFINER fns).
  IF trusted = 'on' THEN
    RETURN NEW;
  END IF;

  -- SECURITY DEFINER / service_role paths with no auth context: allow.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  is_admin_caller := public.is_admin(auth.uid());
  IF is_admin_caller THEN
    RETURN NEW;
  END IF;

  -- Non-admin user: revert every privileged column back to its OLD value.
  NEW.id                 := OLD.id;
  NEW.coins              := OLD.coins;
  NEW.diamonds           := OLD.diamonds;
  NEW.is_vip             := OLD.is_vip;
  NEW.vip_expiry         := OLD.vip_expiry;
  NEW.vip_tier           := OLD.vip_tier;
  NEW.vip_title          := OLD.vip_title;
  NEW.vip_level          := OLD.vip_level;
  NEW.vip_updated_at     := OLD.vip_updated_at;
  NEW.level              := OLD.level;
  NEW.xp                 := OLD.xp;
  NEW.is_free            := OLD.is_free;
  NEW.total_gifted_coins := OLD.total_gifted_coins;
  NEW.status             := OLD.status;
  NEW.user_code          := OLD.user_code;
  NEW.frame_expires_at   := OLD.frame_expires_at;
  NEW.special_id         := OLD.special_id;
  NEW.created_at         := OLD.created_at;

  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.purchase_vip(uuid);
CREATE OR REPLACE FUNCTION public.purchase_vip(_tier_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _tier record;
  _profile record;
  _new_expiry timestamptz;
  _new_coins bigint;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _tier FROM public.vip_tiers WHERE id = _tier_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VIP tier not found or inactive' USING ERRCODE = 'P0002';
  END IF;

  SELECT id, coins, is_vip, vip_expiry
    INTO _profile
    FROM public.profiles
   WHERE id = _uid
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(_profile.coins, 0) < _tier.price THEN
    RAISE EXCEPTION 'Insufficient coins' USING ERRCODE = 'P0001';
  END IF;

  -- Extend from current expiry if still active, else from now.
  _new_expiry := CASE
    WHEN _profile.is_vip AND _profile.vip_expiry IS NOT NULL AND _profile.vip_expiry > now()
      THEN _profile.vip_expiry + make_interval(days => _tier.duration_days)
    ELSE now() + make_interval(days => _tier.duration_days)
  END;

  _new_coins := _profile.coins - _tier.price;

  -- Trusted marker so the profiles guard allows this privileged update.
  PERFORM set_config('app.trusted_definer', 'on', true);

  UPDATE public.profiles
     SET coins          = _new_coins,
         is_vip         = true,
         vip_expiry     = _new_expiry,
         vip_tier       = _tier.name,
         vip_updated_at = now(),
         updated_at     = now()
   WHERE id = _uid;

  PERFORM set_config('app.trusted_definer', 'off', true);

  INSERT INTO public.wallet_transactions
    (user_id, kind, coins, coins_delta, ref_type, ref_id, note, balance_coins_after)
  VALUES
    (_uid, 'vip_purchase', -_tier.price, -_tier.price, 'vip_tier', _tier.id,
     'VIP: ' || _tier.name || ' (' || _tier.duration_days || 'd)', _new_coins);

  RETURN jsonb_build_object(
    'ok', true,
    'tier', _tier.name,
    'coins_after', _new_coins,
    'vip_expiry', _new_expiry
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_vip(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.purchase_vip(uuid) TO authenticated;
