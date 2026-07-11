-- Collection 3: 10 premium animated gifts (no sound) — pure visual PNGs
INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation, clip_path, clip_type, image_url, sort_order, is_active, active)
VALUES
  ('Pink Unicorn',    '🦄', '🦄',  799,  799,  799,  'magic',     'float',    '/__l5e/assets-v1/84421e37-fb8c-4eae-b0b8-8143957a889a/26_unicorn.png',       'png', '/__l5e/assets-v1/84421e37-fb8c-4eae-b0b8-8143957a889a/26_unicorn.png',       26, true, true),
  ('Fire Phoenix',    '🔥', '🔥', 3999, 3999, 3999, 'legendary', 'flame',    '/__l5e/assets-v1/0aa9fef3-f8a9-4066-9bf3-1e0ec5e38dee/27_phoenix.png',        'png', '/__l5e/assets-v1/0aa9fef3-f8a9-4066-9bf3-1e0ec5e38dee/27_phoenix.png',        27, true, true),
  ('Pink Supercar',   '🏎️', '🏎️', 1499, 1499, 1499, 'luxury',    'zoom',     '/__l5e/assets-v1/4315a130-0948-4767-9136-660b96f494bb/28_pink_car.png',       'png', '/__l5e/assets-v1/4315a130-0948-4767-9136-660b96f494bb/28_pink_car.png',       28, true, true),
  ('Panda Love',      '🐼', '🐼',  199,  199,  199,  'love',      'pulse',    '/__l5e/assets-v1/16a48c29-5ffe-4d76-8c4c-a03300a3db45/29_panda_heart.png',    'png', '/__l5e/assets-v1/16a48c29-5ffe-4d76-8c4c-a03300a3db45/29_panda_heart.png',    29, true, true),
  ('Treasure Chest',  '💰', '💰', 2499, 2499, 2499, 'luxury',    'sparkle',  '/__l5e/assets-v1/471ec214-0329-45fb-8f0d-f80e66a9c09e/30_treasure.png',       'png', '/__l5e/assets-v1/471ec214-0329-45fb-8f0d-f80e66a9c09e/30_treasure.png',       30, true, true),
  ('Guardian Angel',  '👼', '👼', 1999, 1999, 1999, 'magic',     'shine',    '/__l5e/assets-v1/4ea3d11f-ff93-4be1-b984-619da10b88a0/31_angel.png',          'png', '/__l5e/assets-v1/4ea3d11f-ff93-4be1-b984-619da10b88a0/31_angel.png',          31, true, true),
  ('Crystal Ball',    '🔮', '🔮',  899,  899,  899,  'magic',    'swirl',    '/__l5e/assets-v1/c72ba4eb-25ca-4fa1-9f12-0983cf8610f6/32_crystal_ball.png',   'png', '/__l5e/assets-v1/c72ba4eb-25ca-4fa1-9f12-0983cf8610f6/32_crystal_ball.png',   32, true, true),
  ('Princess Tiara',  '👑', '👑', 2799, 2799, 2799, 'luxury',    'sparkle',  '/__l5e/assets-v1/f1e6d216-1a46-4f6c-b237-926a6a01867d/33_tiara.png',          'png', '/__l5e/assets-v1/f1e6d216-1a46-4f6c-b237-926a6a01867d/33_tiara.png',          33, true, true),
  ('Sweet Kitten',    '🐱', '🐱',  299,  299,  299,  'love',     'float',    '/__l5e/assets-v1/f921b0a0-ce69-4ed2-a47e-0469d0efc810/34_kitten.png',         'png', '/__l5e/assets-v1/f921b0a0-ce69-4ed2-a47e-0469d0efc810/34_kitten.png',         34, true, true),
  ('Galaxy Planet',   '🪐', '🪐', 4999, 4999, 4999, 'mythic',    'swirl',    '/__l5e/assets-v1/e99e086e-f6c8-413a-beb8-ffb491f57323/35_galaxy_planet.png',  'png', '/__l5e/assets-v1/e99e086e-f6c8-413a-beb8-ffb491f57323/35_galaxy_planet.png',  35, true, true)
ON CONFLICT DO NOTHING;
