-- 0133: Add Ferrari WebM gift
BEGIN;
INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation,
   sort_order, is_active, active, clip_path, clip_type, image_url, sound_url)
VALUES
  ('Ferrari', '🏎️', '🏎️', 1999, 1999, 1000, 'luxury', 'burst', 5, true, true,
   '/animations/gifts/webm/ferrari.webm', 'webm', NULL, NULL);
COMMIT;
