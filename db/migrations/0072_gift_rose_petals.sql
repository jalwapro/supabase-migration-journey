-- Basic Gift #4: Rose Petals — 3D animated with soft sparkle SFX
INSERT INTO public.gifts (name, emoji, icon, image_url, price, price_coins, diamonds_value, category, animation, clip_path, clip_type, sound_url, sort_order, is_active, active)
VALUES (
  'Rose Petals',
  '🌹',
  '🌹',
  '/__l5e/assets-v1/41f1e1ae-b4ca-405f-a062-a261cc7bb1a2/rose-petals.png',
  300,
  300,
  30,
  'love',
  'petals-swirl',
  '/__l5e/assets-v1/e9560194-c89f-4c7c-8ed0-4700a683f616/rose-petals.webm',
  'webm',
  '/__l5e/assets-v1/e2244a95-fbb9-4a88-baa5-0d1e375b8d9e/rose-petals.mp3',
  4,
  true,
  true
)
ON CONFLICT DO NOTHING;
