-- Jalwa VIP video gifts (10 x 5s WebM cinematic videos)
INSERT INTO public.gifts (name, emoji, price, diamonds_value, category, animation, clip_type, clip_path, icon_path, sort_order, is_active)
VALUES
  ('Jalwa VIP Yacht',      '🛥️', 6999, 6999, 'vip', 'pop', 'webm', '/__l5e/assets-v1/d76a95fd-1b9d-48d6-a3ff-6f762bbf4d69/01-vip-yacht.webm',     '/__l5e/assets-v1/d76a95fd-1b9d-48d6-a3ff-6f762bbf4d69/01-vip-yacht.webm',     9101, true),
  ('Jalwa VIP Jet',        '🛩️', 7999, 7999, 'vip', 'pop', 'webm', '/__l5e/assets-v1/34052f6b-acfd-46aa-b9f5-ed42461179b9/02-vip-jet.webm',       '/__l5e/assets-v1/34052f6b-acfd-46aa-b9f5-ed42461179b9/02-vip-jet.webm',       9102, true),
  ('Jalwa VIP Letters',    '🌟', 1999, 1999, 'vip', 'pop', 'webm', '/__l5e/assets-v1/36d504ae-4186-46fb-89a4-e59d9c4b898b/03-vip-letters.webm',   '/__l5e/assets-v1/36d504ae-4186-46fb-89a4-e59d9c4b898b/03-vip-letters.webm',   9103, true),
  ('Jalwa VIP Lion',       '🦁', 5499, 5499, 'vip', 'pop', 'webm', '/__l5e/assets-v1/b8404af2-d8b9-4fd2-a21d-f6e569036a52/04-vip-lion.webm',      '/__l5e/assets-v1/b8404af2-d8b9-4fd2-a21d-f6e569036a52/04-vip-lion.webm',      9104, true),
  ('Jalwa VIP Champagne',  '🍾', 2499, 2499, 'vip', 'pop', 'webm', '/__l5e/assets-v1/96bf73da-5132-4963-ac64-acd2566687b0/05-vip-champagne.webm', '/__l5e/assets-v1/96bf73da-5132-4963-ac64-acd2566687b0/05-vip-champagne.webm', 9105, true),
  ('Jalwa VIP Rolls',      '🚗', 8999, 8999, 'vip', 'pop', 'webm', '/__l5e/assets-v1/fbcb5061-612b-4aef-85a5-2d028ed3f020/06-vip-rolls.webm',     '/__l5e/assets-v1/fbcb5061-612b-4aef-85a5-2d028ed3f020/06-vip-rolls.webm',     9106, true),
  ('Jalwa VIP Watch',      '⌚', 3499, 3499, 'vip', 'pop', 'webm', '/__l5e/assets-v1/63fffe14-0e79-42c9-a5b5-ab39a3b46918/07-vip-watch.webm',     '/__l5e/assets-v1/63fffe14-0e79-42c9-a5b5-ab39a3b46918/07-vip-watch.webm',     9107, true),
  ('Jalwa VIP Tiger',      '🐯', 5999, 5999, 'vip', 'pop', 'webm', '/__l5e/assets-v1/2e19bc87-6030-485a-af78-41d38008de73/08-vip-tiger.webm',     '/__l5e/assets-v1/2e19bc87-6030-485a-af78-41d38008de73/08-vip-tiger.webm',     9108, true),
  ('Jalwa VIP Treasure',   '💰', 4499, 4499, 'vip', 'pop', 'webm', '/__l5e/assets-v1/c7cee888-9abb-4314-9df8-d577c4b2268b/09-vip-treasure.webm',  '/__l5e/assets-v1/c7cee888-9abb-4314-9df8-d577c4b2268b/09-vip-treasure.webm',  9109, true),
  ('Jalwa VIP Ring',       '💍', 9999, 9999, 'vip', 'pop', 'webm', '/__l5e/assets-v1/6642f29f-16f1-49f0-b7b4-c42d5b718367/10-vip-ring.webm',      '/__l5e/assets-v1/6642f29f-16f1-49f0-b7b4-c42d5b718367/10-vip-ring.webm',      9110, true)
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
