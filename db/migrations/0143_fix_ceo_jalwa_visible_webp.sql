-- 0143 — Replace CEO Jalwa with a verified transparent animated WebP.
-- The previous WebM URL was reachable, but the media stream had no alpha
-- channel and rendered as black/blank in previews and DP overlays.

DO $$
DECLARE
  _ceo_theme_id uuid;
  _frame_url text := '/__l5e/assets-v1/7d5a7f68-682c-4137-947b-40f4427eaf45/ceo-jalwa-v4-transparent-fixed.webp';
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
      description = 'Exclusive transparent animated CEO crown + wings DP frame — admin-assigned only',
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
      theme_id = _ceo_theme_id,
      frame_expires_at = NULL,
      updated_at = now()
  WHERE theme_id = _ceo_theme_id
     OR frame ILIKE '%ceo-jalwa%'
     OR frame ILIKE '%frame-ceo-jalwa%';
END $$;

NOTIFY pgrst, 'reload schema';