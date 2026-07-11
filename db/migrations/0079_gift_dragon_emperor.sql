-- Ultra-premium legendary gift: Dragon Emperor
INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation, clip_path, clip_type, image_url, sort_order, is_active, active)
VALUES
  ('Dragon Emperor', '🐉', '🐉', 150000000, 150000000, 150000000, 'mythic', 'shine',
   '/animations/gifts/dragon-emperor.svg', 'svg',
   '/__l5e/assets-v1/5e46c7a5-c498-4738-9170-34109f356a4e/dragon_emperor.png',
   101, true, true)
ON CONFLICT DO NOTHING;
