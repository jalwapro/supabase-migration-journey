-- Jalwa Lion Roar — VIP gift with chromakeyed transparent WebM + real roar audio
INSERT INTO public.gifts (
  name, emoji, price, diamonds_value, category, animation,
  clip_path, clip_type, sound_url, icon_path, sort_order, is_active
) VALUES (
  'Jalwa Lion Roar',
  '🦁',
  5000,
  5000,
  'vip',
  'video',
  '/__l5e/assets-v1/dc85b970-a122-4c3c-90cd-b2993e8116f2/jalwa-lion-roar.webm',
  'webm',
  '/__l5e/assets-v1/67ae4883-d270-40f3-bf90-fddb151a9c48/jalwa-lion-roar.mp3',
  '/__l5e/assets-v1/dc85b970-a122-4c3c-90cd-b2993e8116f2/jalwa-lion-roar.webm',
  10,
  true
)
ON CONFLICT (name) DO UPDATE SET
  price          = EXCLUDED.price,
  diamonds_value = EXCLUDED.diamonds_value,
  category       = EXCLUDED.category,
  animation      = EXCLUDED.animation,
  clip_path      = EXCLUDED.clip_path,
  clip_type      = EXCLUDED.clip_type,
  sound_url      = EXCLUDED.sound_url,
  icon_path      = EXCLUDED.icon_path,
  is_active      = true;
