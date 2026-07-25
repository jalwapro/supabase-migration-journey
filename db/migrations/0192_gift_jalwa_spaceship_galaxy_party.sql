-- Add "Jalwa Spaceship Galaxy Party" premium gift (10,000 coins).
INSERT INTO public.gifts (
  name, emoji, price, price_coins, diamonds_value, category, animation,
  sort_order, is_active, active, clip_path, clip_type, image_url, icon_path, icon, is_milestone
) VALUES (
  'Jalwa Spaceship Galaxy Party',
  '🚀',
  10000,
  10000,
  10000,
  'luxury',
  'fullscreen',
  1,
  true,
  true,
  '/__l5e/assets-v1/a4e0f1c6-3934-4c6e-a767-c887bfbd67bb/jalwa-spaceship-galaxy-party.webm',
  'webm',
  '/__l5e/assets-v1/765ce4cb-f45a-404c-8854-d46ddedebee5/jalwa-spaceship-galaxy-party-thumb.png',
  '/__l5e/assets-v1/765ce4cb-f45a-404c-8854-d46ddedebee5/jalwa-spaceship-galaxy-party-thumb.png',
  '/__l5e/assets-v1/765ce4cb-f45a-404c-8854-d46ddedebee5/jalwa-spaceship-galaxy-party-thumb.png',
  true
)
ON CONFLICT (name) DO UPDATE SET
  price = EXCLUDED.price,
  price_coins = EXCLUDED.price_coins,
  diamonds_value = EXCLUDED.diamonds_value,
  category = EXCLUDED.category,
  animation = EXCLUDED.animation,
  clip_path = EXCLUDED.clip_path,
  clip_type = EXCLUDED.clip_type,
  image_url = EXCLUDED.image_url,
  icon_path = EXCLUDED.icon_path,
  icon = EXCLUDED.icon,
  is_active = true,
  active = true,
  is_milestone = true;
