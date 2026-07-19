-- 0142 — Fix CEO Jalwa DP frame media and admin assignment expiry.
-- The previous WebM had an opaque black background. Replace it with the
-- transparent VP9-alpha asset and update already-equipped profiles.

DO $$
DECLARE
  _ceo_theme_id uuid;
  _frame_url text := '/__l5e/assets-v1/98d1f495-c903-4c77-a770-11b08b3adbd2/ceo-jalwa-v4-transparent.webm';
BEGIN
  SELECT id INTO _ceo_theme_id
  FROM public.themes
  WHERE name = 'CEO Jalwa'
  LIMIT 1;

  IF _ceo_theme_id IS NULL THEN
    RAISE EXCEPTION 'CEO Jalwa theme missing';
  END IF;

  UPDATE public.themes
  SET animation_url = _frame_url,
      preview_url = _frame_url,
      bg_image = NULL,
      description = 'Exclusive transparent CEO crown + wings DP frame — admin-assigned only',
      price = 0,
      price_diamonds = 0,
      duration_days = NULL,
      is_premium = true,
      is_active = false
  WHERE id = _ceo_theme_id;

  UPDATE public.user_themes
  SET expires_at = NULL,
      purchased_price_diamonds = 0
  WHERE theme_id = _ceo_theme_id;

  UPDATE public.profiles
  SET frame = _frame_url,
      frame_expires_at = NULL,
      updated_at = now()
  WHERE theme_id = _ceo_theme_id
     OR frame ILIKE '%ceo-jalwa%'
     OR frame ILIKE '%frame-ceo-jalwa%';
END $$;

DROP FUNCTION IF EXISTS public.admin_assign_frame(uuid, uuid, boolean);

CREATE OR REPLACE FUNCTION public.admin_assign_frame(
  _user_id uuid,
  _theme_id uuid,
  _equip boolean DEFAULT true,
  _expires_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin uuid := auth.uid();
  _theme record;
  _final_expires_at timestamptz;
  _frame_url text;
BEGIN
  IF _admin IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT public.is_admin(_admin) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT
    t.id,
    t.name,
    t.animation_url,
    t.preview_url,
    t.bg_image,
    t.duration_days,
    c.slug AS category_slug,
    c.name AS category_name
  INTO _theme
  FROM public.themes t
  LEFT JOIN public.theme_categories c ON c.id = t.category_id
  WHERE t.id = _theme_id
    AND (c.slug IN ('frame', 'frames') OR c.name ILIKE '%frame%');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'frame not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  _frame_url := COALESCE(_theme.animation_url, _theme.preview_url, _theme.bg_image);
  IF _frame_url IS NULL THEN
    RAISE EXCEPTION 'frame has no media';
  END IF;

  _final_expires_at := COALESCE(
    _expires_at,
    CASE WHEN _theme.duration_days IS NULL THEN NULL ELSE now() + make_interval(days => _theme.duration_days) END
  );

  INSERT INTO public.user_themes (user_id, theme_id, expires_at, purchased_price_diamonds)
  VALUES (_user_id, _theme_id, _final_expires_at, 0)
  ON CONFLICT (user_id, theme_id) DO UPDATE
    SET expires_at = EXCLUDED.expires_at,
        purchased_price_diamonds = 0;

  IF _equip THEN
    UPDATE public.profiles
       SET frame = _frame_url,
           theme_id = _theme_id,
           frame_expires_at = _final_expires_at,
           updated_at = now()
     WHERE id = _user_id;
  END IF;

  INSERT INTO public.admin_logs (admin_id, action, target, details)
  VALUES (
    _admin,
    'assign_frame',
    _user_id::text,
    jsonb_build_object('theme_id', _theme_id, 'theme_name', _theme.name, 'equipped', _equip, 'expires_at', _final_expires_at)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_frame(uuid, uuid, boolean, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';