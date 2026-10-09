CREATE OR REPLACE FUNCTION public.profiles_guard_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE trusted text := current_setting('app.trusted_definer', true);
BEGIN
  IF trusted = 'on' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- No client-authenticated account, including Admin, may directly alter wallet balances.
  -- Wallet changes must pass through audited/atomic trusted RPCs.
  NEW.coins := OLD.coins;
  NEW.diamonds := OLD.diamonds;

  -- Admins may still manage other profile fields, but never wallet balances directly.
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  NEW.id                 := OLD.id;
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

  IF NEW.frame IS NOT NULL AND NEW.frame IS DISTINCT FROM OLD.frame THEN NEW.frame := OLD.frame; END IF;
  IF NEW.ring IS NOT NULL AND NEW.ring IS DISTINCT FROM OLD.ring THEN NEW.ring := OLD.ring; END IF;
  IF NEW.bubble IS NOT NULL AND NEW.bubble IS DISTINCT FROM OLD.bubble THEN NEW.bubble := OLD.bubble; END IF;
  IF NEW.car IS NOT NULL AND NEW.car IS DISTINCT FROM OLD.car THEN NEW.car := OLD.car; END IF;
  IF NEW.entrance IS NOT NULL AND NEW.entrance IS DISTINCT FROM OLD.entrance THEN NEW.entrance := OLD.entrance; END IF;
  IF NEW.data_card IS NOT NULL AND NEW.data_card IS DISTINCT FROM OLD.data_card THEN NEW.data_card := OLD.data_card; END IF;
  IF NEW.theme_id IS NOT NULL AND NEW.theme_id IS DISTINCT FROM OLD.theme_id
     AND NOT public.user_owns_theme(auth.uid(), NEW.theme_id) THEN
    NEW.theme_id := OLD.theme_id;
  END IF;
  RETURN NEW;
END;
$function$;