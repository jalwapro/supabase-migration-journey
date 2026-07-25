BEGIN;
INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation,
   sort_order, is_active, active, clip_path, clip_type, image_url, sound_url)
VALUES
  ('Flower Jalwa', '🌹', '/__l5e/assets-v1/6da724d5-7824-430e-8c0f-2eb25459e177/flower-jalwa-thumb.png',
   49, 49, 25, 'luxury', 'fullscreen',
   9200, true, true,
   '/__l5e/assets-v1/45cbdf4b-90e4-4a37-87ef-88acf6d758fe/flower-jalwa.webm',
   'webm',
   '/__l5e/assets-v1/6da724d5-7824-430e-8c0f-2eb25459e177/flower-jalwa-thumb.png',
   NULL)
ON CONFLICT DO NOTHING;
COMMIT;
