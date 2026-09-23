-- Keep admin-assigned DP frames separate from the user's selected room theme.
-- Frame assignment must never write profiles.theme_id.

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
  IF _admin IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_admin(_admin) THEN RAISE EXCEPTION 'admin only'; END IF;

  SELECT t.id, t.name, t.animation_url, t.preview_url, t.bg_image, t.duration_days,
         c.slug AS category_slug, c.name AS category_name
    INTO _theme
    FROM public.themes t
    LEFT JOIN public.theme_categories c ON c.id = t.category_id
   WHERE t.id = _theme_id
     AND (c.slug IN ('frame', 'frames') OR c.name ILIKE '%frame%');

  IF NOT FOUND THEN RAISE EXCEPTION 'frame not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN RAISE EXCEPTION 'user not found'; END IF;

  _frame_url := COALESCE(_theme.animation_url, _theme.preview_url, _theme.bg_image);
  IF _frame_url IS NULL THEN RAISE EXCEPTION 'frame has no media'; END IF;

  _final_expires_at := COALESCE(
    _expires_at,
    CASE WHEN _theme.duration_days IS NULL THEN NULL
         ELSE now() + make_interval(days => _theme.duration_days) END
  );

  INSERT INTO public.user_themes (user_id, theme_id, expires_at, purchased_price_diamonds)
  VALUES (_user_id, _theme_id, _final_expires_at, 0)
  ON CONFLICT (user_id, theme_id) DO UPDATE
    SET expires_at = EXCLUDED.expires_at,
        purchased_price_diamonds = 0;

  IF _equip THEN
    UPDATE public.profiles
       SET frame = _frame_url,
           frame_expires_at = _final_expires_at,
           updated_at = now()
     WHERE id = _user_id;
  END IF;

  INSERT INTO public.admin_logs (admin_id, action, target, details)
  VALUES (_admin, 'assign_frame', _user_id::text,
          jsonb_build_object('theme_id', _theme_id, 'theme_name', _theme.name,
                             'equipped', _equip, 'expires_at', _final_expires_at));
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_frame(uuid, uuid, boolean, timestamptz) TO authenticated;

-- Repair profiles polluted by the old frame-assignment behavior.
UPDATE public.profiles p
   SET theme_id = NULL,
       updated_at = now()
 WHERE p.theme_id IN (
   SELECT t.id
     FROM public.themes t
     LEFT JOIN public.theme_categories c ON c.id = t.category_id
    WHERE c.slug IN ('frame', 'frames') OR c.name ILIKE '%frame%'
 )
 AND p.frame IS NOT NULL;

NOTIFY pgrst, 'reload schema';
