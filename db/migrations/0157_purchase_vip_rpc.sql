-- C2: Server-side VIP purchase RPC
-- Atomic: validates balance, deducts coins, sets is_vip + expiry, logs transaction.
-- Bypasses the profiles guard trigger via SECURITY DEFINER + set_config marker.

-- Allow this RPC (and other trusted definers) to write privileged columns by
-- setting a session-scoped marker the profiles guard checks.
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

  -- Extend from current expiry if still VIP, else from now
  _new_expiry := CASE
    WHEN _profile.is_vip AND _profile.vip_expiry IS NOT NULL AND _profile.vip_expiry > now()
      THEN _profile.vip_expiry + make_interval(days => _tier.duration_days)
    ELSE now() + make_interval(days => _tier.duration_days)
  END;

  _new_coins := _profile.coins - _tier.price;

  -- Mark session as trusted so profiles guard trigger allows privileged update
  PERFORM set_config('app.trusted_definer', 'on', true);

  UPDATE public.profiles
     SET coins = _new_coins,
         is_vip = true,
         vip_expiry = _new_expiry,
         updated_at = now()
   WHERE id = _uid;

  INSERT INTO public.wallet_transactions (user_id, kind, coins, coins_delta, ref_type, ref_id, note, balance_coins_after)
  VALUES (_uid, 'vip_purchase', -_tier.price, -_tier.price, 'vip_tier', _tier.id,
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

-- Update the profiles guard trigger to honor the trusted marker
CREATE OR REPLACE FUNCTION public.profiles_guard_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean := false;
  _trusted text := current_setting('app.trusted_definer', true);
BEGIN
  -- Trusted server-side RPCs (e.g. purchase_vip) may write privileged columns
  IF _trusted = 'on' THEN
    RETURN NEW;
  END IF;

  BEGIN
    _is_admin := public.is_admin(auth.uid());
  EXCEPTION WHEN OTHERS THEN
    _is_admin := false;
  END;

  IF _is_admin THEN
    RETURN NEW;
  END IF;

  -- Revert privileged columns for non-admin, non-trusted callers
  NEW.coins        := OLD.coins;
  NEW.diamonds     := OLD.diamonds;
  NEW.is_vip       := OLD.is_vip;
  NEW.vip_expiry   := OLD.vip_expiry;
  NEW.vip_tier     := OLD.vip_tier;
  NEW.level        := OLD.level;
  NEW.xp           := OLD.xp;
  NEW.role         := OLD.role;
  NEW.is_banned    := OLD.is_banned;
  NEW.is_muted     := OLD.is_muted;

  RETURN NEW;
END;
$$;
