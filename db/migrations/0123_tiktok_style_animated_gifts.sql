-- 0123 TikTok-style dramatic animated gifts (full-screen SVG effects)
BEGIN;

INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation, sort_order, is_active, active, clip_path, clip_type, image_url)
VALUES
  ('Rose Storm',       '🌹', '🌹',  999,  999,  500, 'romantic', 'burst', 9001, true, true, '/animations/gifts/tiktok-rose-storm.svg',      'svg', NULL),
  ('Lion Roar',        '🦁', '🦁', 1999, 1999, 1000, 'luxury',   'burst', 9002, true, true, '/animations/gifts/tiktok-lion-roar.svg',       'svg', NULL),
  ('Galaxy Portal',    '🪐', '🪐', 2999, 2999, 1500, 'luxury',   'burst', 9003, true, true, '/animations/gifts/tiktok-galaxy-portal.svg',   'svg', NULL),
  ('Dragon Flame',     '🐉', '🐉', 4999, 4999, 2500, 'luxury',   'burst', 9004, true, true, '/animations/gifts/tiktok-dragon-flame.svg',    'svg', NULL),
  ('Crown King',       '👑', '👑', 3999, 3999, 2000, 'luxury',   'burst', 9005, true, true, '/animations/gifts/tiktok-crown-king.svg',      'svg', NULL),
  ('Heart Fireworks',  '💘', '💘', 1499, 1499,  750, 'romantic', 'burst', 9006, true, true, '/animations/gifts/tiktok-heart-fireworks.svg', 'svg', NULL)
ON CONFLICT DO NOTHING;

COMMIT;
