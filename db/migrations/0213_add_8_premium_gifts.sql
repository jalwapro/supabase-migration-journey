-- 8 Premium tier gifts (1000-2000 coins) with HD transparent WebP animations
INSERT INTO gifts (name, emoji, price, price_coins, diamonds_value, category, animation, sort_order, is_active, active, clip_path, clip_type, icon_path, image_url)
VALUES
  ('Rose Bouquet',    '🌹', 1000, 1000, 1000, 'premium', 'premium', 8001, true, true, '/__l5e/assets-v1/c992fd5c-b682-4db2-b53d-2d93349a985a/jalwa-roses.webp',       'webp', '/__l5e/assets-v1/ad80ce2d-9b70-429d-8c0a-0bdded566d9a/jalwa-roses-poster.webp',       '/__l5e/assets-v1/ad80ce2d-9b70-429d-8c0a-0bdded566d9a/jalwa-roses-poster.webp'),
  ('Teddy Love',      '🧸', 1100, 1100, 1100, 'premium', 'premium', 8002, true, true, '/__l5e/assets-v1/86115710-6f47-443c-a30a-c5907afc19a2/jalwa-teddy.webp',       'webp', '/__l5e/assets-v1/0d103d72-385f-4f4b-8fe5-a8bad389353e/jalwa-teddy-poster.webp',       '/__l5e/assets-v1/0d103d72-385f-4f4b-8fe5-a8bad389353e/jalwa-teddy-poster.webp'),
  ('Champagne Pop',   '🍾', 1200, 1200, 1200, 'premium', 'premium', 8003, true, true, '/__l5e/assets-v1/4f5e54c5-ec57-4b9b-a03c-0737c27ada87/jalwa-champagne.webp',   'webp', '/__l5e/assets-v1/cc353e3a-18da-4e33-ac08-b4736b4a1641/jalwa-champagne-poster.webp',   '/__l5e/assets-v1/cc353e3a-18da-4e33-ac08-b4736b4a1641/jalwa-champagne-poster.webp'),
  ('Fireworks Burst', '🎆', 1300, 1300, 1300, 'premium', 'premium', 8004, true, true, '/__l5e/assets-v1/ff941bab-dea8-419d-812f-fa0a57f36a8b/jalwa-fireworks.webp',   'webp', '/__l5e/assets-v1/31a083b1-4666-4522-9c1f-bf318b3b144f/jalwa-fireworks-poster.webp',   '/__l5e/assets-v1/31a083b1-4666-4522-9c1f-bf318b3b144f/jalwa-fireworks-poster.webp'),
  ('Love Letter',     '💌', 1400, 1400, 1400, 'premium', 'premium', 8005, true, true, '/__l5e/assets-v1/cf617dbf-a562-4ec5-aa0e-665e10df4a45/jalwa-love-letter.webp', 'webp', '/__l5e/assets-v1/d5791496-9826-4724-acdd-708f6348c91d/jalwa-love-letter-poster.webp', '/__l5e/assets-v1/d5791496-9826-4724-acdd-708f6348c91d/jalwa-love-letter-poster.webp'),
  ('Magic Wand',      '🪄', 1500, 1500, 1500, 'premium', 'premium', 8006, true, true, '/__l5e/assets-v1/3c708da7-c8c5-40d3-bc5d-ef598ee21a3f/jalwa-magic-wand.webp',  'webp', '/__l5e/assets-v1/d89c3325-3a58-42a9-ad3a-db1058d08ef5/jalwa-magic-wand-poster.webp',  '/__l5e/assets-v1/d89c3325-3a58-42a9-ad3a-db1058d08ef5/jalwa-magic-wand-poster.webp'),
  ('Cupid Arrow',     '🏹', 1700, 1700, 1700, 'premium', 'premium', 8007, true, true, '/__l5e/assets-v1/27c412b9-3f59-4834-9b17-336cf1c4d790/jalwa-cupid.webp',       'webp', '/__l5e/assets-v1/844ba63e-23b9-4f65-9d7b-c710093b3480/jalwa-cupid-poster.webp',       '/__l5e/assets-v1/844ba63e-23b9-4f65-9d7b-c710093b3480/jalwa-cupid-poster.webp'),
  ('Angel Wings',     '👼', 2000, 2000, 2000, 'premium', 'premium', 8008, true, true, '/__l5e/assets-v1/9ab67af4-7de1-4fdb-b40b-0b254ee3fa12/jalwa-angel-wings.webp', 'webp', '/__l5e/assets-v1/e8f97347-60cf-4679-aa16-00d4e74b347c/jalwa-angel-wings-poster.webp', '/__l5e/assets-v1/e8f97347-60cf-4679-aa16-00d4e74b347c/jalwa-angel-wings-poster.webp')
ON CONFLICT (name) DO UPDATE SET
  price = EXCLUDED.price,
  price_coins = EXCLUDED.price_coins,
  diamonds_value = EXCLUDED.diamonds_value,
  category = EXCLUDED.category,
  animation = EXCLUDED.animation,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  active = true,
  clip_path = EXCLUDED.clip_path,
  clip_type = EXCLUDED.clip_type,
  icon_path = EXCLUDED.icon_path,
  image_url = EXCLUDED.image_url;
