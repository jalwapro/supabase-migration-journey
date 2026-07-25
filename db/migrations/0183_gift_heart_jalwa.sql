BEGIN;
INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation,
   sort_order, is_active, active, clip_path, clip_type, image_url, sound_url)
VALUES
  ('Heart Jalwa', '❤️',
   '/__l5e/assets-v1/95b9534f-a425-4ee8-acc9-d2d240d9020f/heart-jalwa-thumb.png',
   29, 29, 15, 'luxury', 'fullscreen',
   9300, true, true,
   '/__l5e/assets-v1/df056474-ad5b-4f60-ae36-7a4a0c5440f7/heart-jalwa.webm',
   'webm',
   '/__l5e/assets-v1/95b9534f-a425-4ee8-acc9-d2d240d9020f/heart-jalwa-thumb.png',
   NULL)
ON CONFLICT DO NOTHING;
COMMIT;
