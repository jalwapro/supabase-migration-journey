-- Add Jalwa Puppy Love VIP gift (cute puppy that farts hearts).
DELETE FROM public.gift_sends WHERE gift_id IN (SELECT id FROM public.gifts WHERE lower(name) = 'jalwa puppy love');
DELETE FROM public.gifts WHERE lower(name) = 'jalwa puppy love';

INSERT INTO public.gifts
  (name, category, price, price_coins, diamonds_value, icon, image_url, icon_path, clip_path, clip_type, animation, is_active, active)
VALUES (
  'Jalwa Puppy Love',
  'vip',
  200,
  200,
  200,
  '/__l5e/assets-v1/9cf381dd-42c4-4d0e-b422-e784f310e808/puppy-fart-heart-thumb.png',
  '/__l5e/assets-v1/9cf381dd-42c4-4d0e-b422-e784f310e808/puppy-fart-heart-thumb.png',
  '/__l5e/assets-v1/9cf381dd-42c4-4d0e-b422-e784f310e808/puppy-fart-heart-thumb.png',
  '/__l5e/assets-v1/6e9e9e7b-8a99-4387-beea-5cfe7ccf361b/puppy-fart-heart.mp4',
  'mp4',
  'fullscreen',
  true,
  true
);
