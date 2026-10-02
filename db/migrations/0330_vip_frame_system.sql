-- 0330 — VIP Frame & Profile Card system
-- Tier assets live on vip_level_config (one row per level). Users get the
-- assets of the highest configured level <= their VIP level; admins can force
-- a level or custom assets per user.

ALTER TABLE public.vip_level_config
  ADD COLUMN IF NOT EXISTS profile_card_bg_url text,
  ADD COLUMN IF NOT EXISTS frame_animation text NOT NULL DEFAULT 'glow';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vip_level_override integer,
  ADD COLUMN IF NOT EXISTS vip_frame_override_url text,
  ADD COLUMN IF NOT EXISTS vip_card_override_url text,
  ADD COLUMN IF NOT EXISTS vip_popup_override_url text;

CREATE INDEX IF NOT EXISTS idx_vip_level_config_threshold ON public.vip_level_config (threshold_coins);

-- Keep override columns admin-only via the existing guard trigger pattern.
CREATE OR REPLACE FUNCTION public.profiles_guard_vip_overrides()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN RETURN NEW; END IF;
  NEW.vip_level_override     := OLD.vip_level_override;
  NEW.vip_frame_override_url := OLD.vip_frame_override_url;
  NEW.vip_card_override_url  := OLD.vip_card_override_url;
  NEW.vip_popup_override_url := OLD.vip_popup_override_url;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profiles_guard_vip_overrides ON public.profiles;
CREATE TRIGGER profiles_guard_vip_overrides BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_vip_overrides();

-- Recalculate a user's VIP level from lifetime gifted coins (override wins).
CREATE OR REPLACE FUNCTION public.check_and_update_vip_tier(_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _coins bigint; _override int; _cur int; _calc int; _new int; _tier text; _title text;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT COALESCE(total_gifted_coins,0), vip_level_override, COALESCE(vip_level,0)
    INTO _coins, _override, _cur FROM public.profiles WHERE id = _user_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  SELECT COALESCE(MAX(level),0) INTO _calc FROM public.vip_level_config WHERE threshold_coins <= _coins;
  _new := COALESCE(_override, GREATEST(_calc, _cur));
  IF _new <> _cur THEN
    SELECT tier, title INTO _tier, _title FROM public.vip_level_config WHERE level = _new;
    UPDATE public.profiles
       SET vip_level = _new, vip_tier = COALESCE(_tier, vip_tier), vip_title = COALESCE(_title, vip_title),
           vip_updated_at = now()
     WHERE id = _user_id;
  END IF;
  RETURN _new;
END $$;
REVOKE ALL ON FUNCTION public.check_and_update_vip_tier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_update_vip_tier(uuid) TO authenticated, service_role;

-- Auto-upgrade instantly whenever lifetime gifted coins change.
CREATE OR REPLACE FUNCTION public.profiles_auto_vip_upgrade()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _calc int;
BEGIN
  IF NEW.vip_level_override IS NOT NULL THEN
    NEW.vip_level := NEW.vip_level_override; RETURN NEW;
  END IF;
  SELECT COALESCE(MAX(level),0) INTO _calc FROM public.vip_level_config
   WHERE threshold_coins <= COALESCE(NEW.total_gifted_coins,0);
  IF _calc > COALESCE(NEW.vip_level,0) THEN
    NEW.vip_level := _calc; NEW.vip_updated_at := now();
    SELECT COALESCE(tier, NEW.vip_tier), COALESCE(title, NEW.vip_title)
      INTO NEW.vip_tier, NEW.vip_title FROM public.vip_level_config WHERE level = _calc;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_profiles_auto_vip_upgrade ON public.profiles;
CREATE TRIGGER zz_profiles_auto_vip_upgrade BEFORE UPDATE OF total_gifted_coins, vip_level_override ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_auto_vip_upgrade();

-- Admin manual override (level and/or custom assets). Pass NULLs to clear.
CREATE OR REPLACE FUNCTION public.admin_set_vip_override(
  _user_id uuid, _level int, _frame_url text, _card_url text, _popup_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'admins only'; END IF;
  UPDATE public.profiles SET
    vip_level_override = _level,
    vip_level = COALESCE(_level, vip_level),
    vip_frame_override_url = NULLIF(_frame_url,''),
    vip_card_override_url = NULLIF(_card_url,''),
    vip_popup_override_url = NULLIF(_popup_url,''),
    vip_updated_at = now()
  WHERE id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found'; END IF;
  IF _level IS NULL THEN PERFORM public.check_and_update_vip_tier(_user_id); END IF;
  IF to_regclass('public.vip_admin_logs') IS NOT NULL THEN
    BEGIN
      EXECUTE 'INSERT INTO public.vip_admin_logs (admin_id, user_id, action, details) VALUES ($1,$2,$3,$4)'
      USING auth.uid(), _user_id, 'vip_override',
        jsonb_build_object('level',_level,'frame',_frame_url,'card',_card_url,'popup',_popup_url);
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_vip_override(uuid,int,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_vip_override(uuid,int,text,text,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
