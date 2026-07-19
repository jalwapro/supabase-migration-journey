-- CEO Jalwa DP Frame — admin-only, not for sale in shop.
-- is_active = false hides it from the public shop; admin panel can still see
-- and assign it manually to specific users via user_themes.
DO $$
DECLARE
  _cat uuid;
BEGIN
  SELECT id INTO _cat FROM public.theme_categories WHERE slug = 'frame' LIMIT 1;
  IF _cat IS NULL THEN RAISE EXCEPTION 'frame category missing'; END IF;

  INSERT INTO public.themes
    (name, description, category_id, animation_url, preview_url,
     price, price_diamonds, duration_days, is_premium, is_active, sort, is_free)
  SELECT 'CEO Jalwa',
         'Exclusive CEO crown + wings frame — admin-assigned only',
         _cat,
         '/__l5e/assets-v1/98ce4e78-3ab6-40be-9c66-1f32553a3491/frame-ceo-jalwa.webm',
         '/__l5e/assets-v1/98ce4e78-3ab6-40be-9c66-1f32553a3491/frame-ceo-jalwa.webm',
         0, 0, NULL, true, false, 0, false
  WHERE NOT EXISTS (SELECT 1 FROM public.themes WHERE name = 'CEO Jalwa');
END $$;
