BEGIN;
INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation,
   sort_order, is_active, active, clip_path, clip_type, image_url, sound_url)
VALUES
  ('Hand Heart', '🤝', '🤝', 39, 39, 20, 'luxury', 'fullscreen',
   9100, true, true,
   '/__l5e/assets-v1/84ec4f02-bafd-405a-a36b-c6af7cf44fb3/hand-heart.mp4',
   'mp4', NULL, NULL)
ON CONFLICT DO NOTHING;
COMMIT;
