-- Jalwa Premium video gifts (10 x 5s WebM cinematic videos)
INSERT INTO public.gifts (name, emoji, price, diamonds_value, category, animation, clip_type, clip_path, icon_path, sort_order, is_active)
VALUES
  ('Jalwa Phoenix Rise',      '🔥', 5000, 5000, 'premium', 'pop', 'webm', '/__l5e/assets-v1/5a15e6c9-0e1f-40f9-b838-328a22cce404/01-phoenix-rise.webm',      '/__l5e/assets-v1/5a15e6c9-0e1f-40f9-b838-328a22cce404/01-phoenix-rise.webm',      9001, true),
  ('Jalwa Diamond Storm',     '💎', 3999, 3999, 'premium', 'pop', 'webm', '/__l5e/assets-v1/9aa8c261-4070-476c-939c-2f6791c5a11c/02-diamond-storm.webm',     '/__l5e/assets-v1/9aa8c261-4070-476c-939c-2f6791c5a11c/02-diamond-storm.webm',     9002, true),
  ('Jalwa Royal Crown',       '👑', 2999, 2999, 'premium', 'pop', 'webm', '/__l5e/assets-v1/1ba3ffb9-742c-4110-af61-2464d40bd8b5/03-royal-crown.webm',       '/__l5e/assets-v1/1ba3ffb9-742c-4110-af61-2464d40bd8b5/03-royal-crown.webm',       9003, true),
  ('Jalwa Ferrari Drift',     '🏎️', 3499, 3499, 'premium', 'pop', 'webm', '/__l5e/assets-v1/5a3cd2ae-debc-4f75-acd5-42c289646b6e/04-ferrari-drift.webm',     '/__l5e/assets-v1/5a3cd2ae-debc-4f75-acd5-42c289646b6e/04-ferrari-drift.webm',     9004, true),
  ('Jalwa Money Tornado',     '💸', 1999, 1999, 'premium', 'pop', 'webm', '/__l5e/assets-v1/113d3d69-f117-4ebb-9157-b767edb4ca76/05-money-tornado.webm',     '/__l5e/assets-v1/113d3d69-f117-4ebb-9157-b767edb4ca76/05-money-tornado.webm',     9005, true),
  ('Jalwa Palace Fireworks',  '🎆', 2499, 2499, 'premium', 'pop', 'webm', '/__l5e/assets-v1/795bba07-3ab8-4642-a9f6-e9dd28fe7735/06-palace-fireworks.webm',  '/__l5e/assets-v1/795bba07-3ab8-4642-a9f6-e9dd28fe7735/06-palace-fireworks.webm',  9006, true),
  ('Jalwa Dragon Fury',       '🐉', 4499, 4499, 'premium', 'pop', 'webm', '/__l5e/assets-v1/1d0070e1-52c8-4f3a-9c36-0ebcc2279fab/07-dragon-fury.webm',       '/__l5e/assets-v1/1d0070e1-52c8-4f3a-9c36-0ebcc2279fab/07-dragon-fury.webm',       9007, true),
  ('Jalwa Angel Wings',       '👼', 2799, 2799, 'premium', 'pop', 'webm', '/__l5e/assets-v1/47d8afca-3e94-4913-8b26-4f2125a1c77d/08-angel-wings.webm',       '/__l5e/assets-v1/47d8afca-3e94-4913-8b26-4f2125a1c77d/08-angel-wings.webm',       9008, true),
  ('Jalwa Galaxy Throne',     '🌌', 4999, 4999, 'premium', 'pop', 'webm', '/__l5e/assets-v1/56e60b2b-38cb-4e01-b540-d6436822e20a/09-galaxy-throne.webm',     '/__l5e/assets-v1/56e60b2b-38cb-4e01-b540-d6436822e20a/09-galaxy-throne.webm',     9009, true),
  ('Jalwa Rose Explosion',    '🌹',  999,  999, 'premium', 'pop', 'webm', '/__l5e/assets-v1/dcd74d68-f801-4fb8-b200-e0fdd83f746e/10-rose-explosion.webm',    '/__l5e/assets-v1/dcd74d68-f801-4fb8-b200-e0fdd83f746e/10-rose-explosion.webm',    9010, true)
ON CONFLICT (name) DO UPDATE SET
  emoji = EXCLUDED.emoji,
  price = EXCLUDED.price,
  diamonds_value = EXCLUDED.diamonds_value,
  category = EXCLUDED.category,
  animation = EXCLUDED.animation,
  clip_type = EXCLUDED.clip_type,
  clip_path = EXCLUDED.clip_path,
  icon_path = EXCLUDED.icon_path,
  sort_order = EXCLUDED.sort_order,
  is_active = true;
