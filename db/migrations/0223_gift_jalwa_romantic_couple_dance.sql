-- Add Jalwa Romantic Couple Dance VIP gift (50000 coins).
DELETE FROM public.gift_sends WHERE gift_id IN (SELECT id FROM public.gifts WHERE lower(name) = 'jalwa romantic couple');
DELETE FROM public.gifts WHERE lower(name) = 'jalwa romantic couple';

INSERT INTO public.gifts
  (name, category, price, price_coins, diamonds_value, icon, image_url, icon_path, clip_path, clip_type, animation, is_active, active)
VALUES (
  'Jalwa Romantic Couple',
  'vip',
  50000,
  50000,
  50000,
  '/__l5e/assets-v1/60af5820-b0c1-46e7-aefa-f440ee8ae2f4/jalwa-romantic-couple-dance.png',
  '/__l5e/assets-v1/60af5820-b0c1-46e7-aefa-f440ee8ae2f4/jalwa-romantic-couple-dance.png',
  '/__l5e/assets-v1/60af5820-b0c1-46e7-aefa-f440ee8ae2f4/jalwa-romantic-couple-dance.png',
  '/__l5e/assets-v1/15cf7d0b-055e-4e9d-a17f-460ffa624569/jalwa-romantic-couple-dance.mp4',
  'mp4',
  'fullscreen',
  true,
  true
);
