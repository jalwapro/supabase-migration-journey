-- Premium gift: Romantic Couple (1000 coins). Transparent SVG animation, no background.
INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation, clip_path, clip_type, image_url, sort_order, is_active, active, sound_url)
VALUES
  ('Romantic Couple', '💑', '💑', 1000, 1000, 1000, 'premium', 'float',
   '/animations/gifts/jalwa-romantic-couple.svg', 'svg',
   '/animations/gifts/jalwa-romantic-couple.svg', 50, true, true, NULL)
ON CONFLICT (name) DO UPDATE SET
  price = EXCLUDED.price,
  price_coins = EXCLUDED.price_coins,
  diamonds_value = EXCLUDED.diamonds_value,
  category = EXCLUDED.category,
  animation = EXCLUDED.animation,
  clip_path = EXCLUDED.clip_path,
  clip_type = EXCLUDED.clip_type,
  image_url = EXCLUDED.image_url,
  emoji = EXCLUDED.emoji,
  icon = EXCLUDED.icon,
  is_active = true,
  active = true,
  sound_url = NULL;
