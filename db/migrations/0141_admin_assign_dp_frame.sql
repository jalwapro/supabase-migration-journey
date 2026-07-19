-- 0141 — Admin can grant and equip hidden DP frames to any user.
-- CEO/VIP frames are shop-hidden (is_active=false), so admins need a secure RPC
-- to assign them without making them publicly purchasable.

CREATE OR REPLACE FUNCTION public.admin_assign_frame(
  _user_id uuid,
  _theme_id uuid,
  _equip boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin uuid := auth.uid();
  _theme record;
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
    c.slug AS category_slug
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

  INSERT INTO public.user_themes (user_id, theme_id, expires_at, purchased_price_diamonds)
  VALUES (
    _user_id,
    _theme_id,
    CASE WHEN _theme.duration_days IS NULL THEN NULL ELSE now() + make_interval(days => _theme.duration_days) END,
    0
  )
  ON CONFLICT (user_id, theme_id) DO UPDATE
    SET expires_at = EXCLUDED.expires_at,
        purchased_price_diamonds = 0;

  IF _equip THEN
    UPDATE public.profiles
       SET frame = COALESCE(_theme.animation_url, _theme.preview_url, _theme.bg_image),
           updated_at = now()
     WHERE id = _user_id;
  END IF;

  INSERT INTO public.admin_logs (admin_id, action, target, details)
  VALUES (
    _admin,
    'assign_frame',
    _user_id::text,
    jsonb_build_object('theme_id', _theme_id, 'theme_name', _theme.name, 'equipped', _equip)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_clear_frame(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin uuid := auth.uid();
BEGIN
  IF _admin IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT public.is_admin(_admin) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  UPDATE public.profiles
     SET frame = NULL,
         updated_at = now()
   WHERE id = _user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  INSERT INTO public.admin_logs (admin_id, action, target, details)
  VALUES (_admin, 'clear_frame', _user_id::text, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_frame(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_frame(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';