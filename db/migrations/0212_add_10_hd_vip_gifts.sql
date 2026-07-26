-- 10 HD VIP gifts with transparent WebP animations
INSERT INTO gifts (name, emoji, price, price_coins, diamonds_value, category, animation, sort_order, is_active, active, clip_path, clip_type, icon_path, image_url)
VALUES
  ('Golden Dragon',    '🐉', 15000, 15000, 15000, 'vip', 'legendary', 9001, true, true, '/__l5e/assets-v1/bb5283ea-a488-45e6-b3b8-673f6582ae4a/jalwa-golden-dragon.webp', 'webp', '/__l5e/assets-v1/54c95cc3-abfb-4042-aa16-85e9dc58d6cf/jalwa-golden-dragon-poster.webp', '/__l5e/assets-v1/54c95cc3-abfb-4042-aa16-85e9dc58d6cf/jalwa-golden-dragon-poster.webp'),
  ('Phoenix Rebirth',  '🔥', 12000, 12000, 12000, 'vip', 'legendary', 9002, true, true, '/__l5e/assets-v1/e2bbd4b1-7032-43a1-bba8-bd4d72236877/jalwa-phoenix.webp',        'webp', '/__l5e/assets-v1/875cf0cd-ca01-4e74-9618-7cbff01d9377/jalwa-phoenix-poster.webp',        '/__l5e/assets-v1/875cf0cd-ca01-4e74-9618-7cbff01d9377/jalwa-phoenix-poster.webp'),
  ('Diamond Castle',   '🏰', 10000, 10000, 10000, 'vip', 'legendary', 9003, true, true, '/__l5e/assets-v1/53e0768c-a01a-4371-9915-d93e7c8d3f5b/jalwa-castle.webp',         'webp', '/__l5e/assets-v1/7bcfd057-2ea6-477c-8794-544f891060f9/jalwa-castle-poster.webp',         '/__l5e/assets-v1/7bcfd057-2ea6-477c-8794-544f891060f9/jalwa-castle-poster.webp'),
  ('Diamond Heart',    '💎', 9000,  9000,  9000,  'vip', 'legendary', 9004, true, true, '/__l5e/assets-v1/e322d881-0818-4290-89f1-b471e99c5d0f/jalwa-diamond-heart.webp',  'webp', '/__l5e/assets-v1/b9ac4ae0-5d35-4ab9-a681-fc13f395013c/jalwa-diamond-heart-poster.webp',  '/__l5e/assets-v1/b9ac4ae0-5d35-4ab9-a681-fc13f395013c/jalwa-diamond-heart-poster.webp'),
  ('Luxury Yacht',     '🛥️', 8000,  8000,  8000,  'vip', 'legendary', 9005, true, true, '/__l5e/assets-v1/239e5d9b-8516-4241-a5e7-2c3a63891566/jalwa-yacht.webp',          'webp', '/__l5e/assets-v1/e91610c8-e383-4f79-bcd7-8375fd97f3af/jalwa-yacht-poster.webp',          '/__l5e/assets-v1/e91610c8-e383-4f79-bcd7-8375fd97f3af/jalwa-yacht-poster.webp'),
  ('Royal Crown',      '👑', 7500,  7500,  7500,  'vip', 'legendary', 9006, true, true, '/__l5e/assets-v1/c5cf7c18-03e7-4a48-99de-4dc169c671ee/jalwa-crown.webp',          'webp', '/__l5e/assets-v1/f5d7cded-c869-4017-a8c6-201f3dac088c/jalwa-crown-poster.webp',          '/__l5e/assets-v1/f5d7cded-c869-4017-a8c6-201f3dac088c/jalwa-crown-poster.webp'),
  ('Private Jet',      '✈️', 7000,  7000,  7000,  'vip', 'legendary', 9007, true, true, '/__l5e/assets-v1/6d0ac40f-9955-4c45-950f-e3fcc5643fcf/jalwa-jet.webp',            'webp', '/__l5e/assets-v1/4c5da70d-a360-426c-868d-d0aea7cf4270/jalwa-jet-poster.webp',            '/__l5e/assets-v1/4c5da70d-a360-426c-868d-d0aea7cf4270/jalwa-jet-poster.webp'),
  ('Rocket Launch',    '🚀', 6500,  6500,  6500,  'vip', 'legendary', 9008, true, true, '/__l5e/assets-v1/6ddd21c9-c6d9-43d2-9a43-6d1e326ee894/jalwa-rocket.webp',         'webp', '/__l5e/assets-v1/a6ad1a75-4c4e-48e3-8048-daad247a1711/jalwa-rocket-poster.webp',         '/__l5e/assets-v1/a6ad1a75-4c4e-48e3-8048-daad247a1711/jalwa-rocket-poster.webp'),
  ('Lambo Drift',      '🏎️', 6000,  6000,  6000,  'vip', 'legendary', 9009, true, true, '/__l5e/assets-v1/bf2cd057-2b1f-4c54-9819-06a1a860a3af/jalwa-lambo.webp',          'webp', '/__l5e/assets-v1/8a1d3572-babf-4907-9e3d-86496532a070/jalwa-lambo-poster.webp',          '/__l5e/assets-v1/8a1d3572-babf-4907-9e3d-86496532a070/jalwa-lambo-poster.webp'),
  ('Unicorn Rainbow',  '🦄', 5000,  5000,  5000,  'vip', 'legendary', 9010, true, true, '/__l5e/assets-v1/1712ba32-7a18-4b3a-af8f-175e98c8dc06/jalwa-unicorn.webp',        'webp', '/__l5e/assets-v1/2b24e893-a042-4925-ad8b-600d8858da95/jalwa-unicorn-poster.webp',        '/__l5e/assets-v1/2b24e893-a042-4925-ad8b-600d8858da95/jalwa-unicorn-poster.webp')
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
