-- Jalwa Legendary luxury video gifts (10 x 5s WebM cinematic videos, ultra expensive tier)
INSERT INTO public.gifts (name, emoji, price, diamonds_value, category, animation, clip_type, clip_path, icon_path, sort_order, is_active)
VALUES
  ('Jalwa Diamond Palace',    '🏰', 14999, 14999, 'luxury', 'pop', 'webm', '/__l5e/assets-v1/4e85c7ae-cd76-4668-b229-2b49c9892c03/01-diamond-palace.webm',    '/__l5e/assets-v1/4e85c7ae-cd76-4668-b229-2b49c9892c03/01-diamond-palace.webm',    9201, true),
  ('Jalwa Dragon Throne',     '🐉', 19999, 19999, 'luxury', 'pop', 'webm', '/__l5e/assets-v1/3bc68428-e69c-482e-aa81-8a7fd90f31c3/02-dragon-throne.webm',     '/__l5e/assets-v1/3bc68428-e69c-482e-aa81-8a7fd90f31c3/02-dragon-throne.webm',     9202, true),
  ('Jalwa Cosmic Empire',     '🌌', 24999, 24999, 'luxury', 'pop', 'webm', '/__l5e/assets-v1/ada63814-4874-4b87-adf9-4e1a6dfc013d/03-cosmic-empire.webm',     '/__l5e/assets-v1/ada63814-4874-4b87-adf9-4e1a6dfc013d/03-cosmic-empire.webm',     9203, true),
  ('Jalwa Royal Peacock',     '🦚', 12999, 12999, 'luxury', 'pop', 'webm', '/__l5e/assets-v1/a0a6e7b5-853e-4d9b-8a17-ff2066588c05/04-royal-peacock.webm',     '/__l5e/assets-v1/a0a6e7b5-853e-4d9b-8a17-ff2066588c05/04-royal-peacock.webm',     9204, true),
  ('Jalwa Sapphire Kraken',   '🐙', 17999, 17999, 'luxury', 'pop', 'webm', '/__l5e/assets-v1/2d67a7e9-56c1-4f4e-9489-2dda0f5a689a/05-sapphire-kraken.webm',   '/__l5e/assets-v1/2d67a7e9-56c1-4f4e-9489-2dda0f5a689a/05-sapphire-kraken.webm',   9205, true),
  ('Jalwa Pharaoh Chariot',   '🏺', 21999, 21999, 'luxury', 'pop', 'webm', '/__l5e/assets-v1/62134a7f-65ed-4fa7-8509-873774e0c4b9/06-pharaoh-chariot.webm',   '/__l5e/assets-v1/62134a7f-65ed-4fa7-8509-873774e0c4b9/06-pharaoh-chariot.webm',   9206, true),
  ('Jalwa Crystal Kingdom',   '💠', 15999, 15999, 'luxury', 'pop', 'webm', '/__l5e/assets-v1/225a38bc-4c19-463a-b6f2-5f81115f6ac3/07-crystal-kingdom.webm',   '/__l5e/assets-v1/225a38bc-4c19-463a-b6f2-5f81115f6ac3/07-crystal-kingdom.webm',   9207, true),
  ('Jalwa Celestial Phoenix', '🔥', 27999, 27999, 'luxury', 'pop', 'webm', '/__l5e/assets-v1/9bebb37f-52f0-4625-9354-7d8e1172a439/08-celestial-phoenix.webm', '/__l5e/assets-v1/9bebb37f-52f0-4625-9354-7d8e1172a439/08-celestial-phoenix.webm', 9208, true),
  ('Jalwa Universe Crown',    '👑', 34999, 34999, 'luxury', 'pop', 'webm', '/__l5e/assets-v1/50caf51f-c253-49b1-9502-13e5d8139851/09-universe-crown.webm',    '/__l5e/assets-v1/50caf51f-c253-49b1-9502-13e5d8139851/09-universe-crown.webm',    9209, true),
  ('Jalwa Immortal Throne',   '⚡', 49999, 49999, 'luxury', 'pop', 'webm', '/__l5e/assets-v1/bc8ea34f-f75a-4b5b-9407-c627bdde9bd0/10-immortal-throne.webm',   '/__l5e/assets-v1/bc8ea34f-f75a-4b5b-9407-c627bdde9bd0/10-immortal-throne.webm',   9210, true)
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
