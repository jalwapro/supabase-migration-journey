-- 0143 — Replace CEO Jalwa with a verified transparent PNG fallback.
-- The earlier WebM/WebP assets either rendered black/blank or were blocked
-- by relative asset URL resolution in previews and DP overlays.

DO $$
DECLARE
  _ceo_theme_id uuid;
  _frame_url text := 'https://project--269a4b2a-bb70-44e1-bd04-6acc825e6f84.lovable.app/__l5e/assets-v1/832baf19-ff34-4d30-9368-bd766eecc513/ceo-jalwa-v4-visible-alpha.png';
  _phoenix_url text := 'https://project--269a4b2a-bb70-44e1-bd04-6acc825e6f84.lovable.app/__l5e/assets-v1/b17696dc-8ded-49e8-af08-95eabcd23b9e/frame-phoenix-gold.webm';
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

  UPDATE public.themes
  SET animation_url = _phoenix_url,
      preview_url = _phoenix_url,
      bg_image = NULL
  WHERE name = 'Golden Phoenix Live';

  UPDATE public.profiles
  SET frame = _phoenix_url,
      updated_at = now()
  WHERE frame = '/__l5e/assets-v1/b17696dc-8ded-49e8-af08-95eabcd23b9e/frame-phoenix-gold.webm';
END $$;

NOTIFY pgrst, 'reload schema';