-- 0172 Real illustrated starter pack — 25 TikTok-style premium PNG gifts.
-- Sort orders 1..25 so these appear first in every category tab.
BEGIN;

WITH data(name, emoji, icon, price, price_coins, diamonds_value, category, animation, sort_order, clip_path, clip_type, is_active, active) AS (
  VALUES
  ('Rose',        '🌹', '🌹',      10,     10,      5,  'love',    'pop',  1, '/animations/gifts/starter25/rose.png',         'png', true, true),
  ('Heart',       '❤️', '❤️',        5,      5,      2,  'love',    'pop',  2, '/animations/gifts/starter25/heart.png',        'png', true, true),
  ('Teddy Bear',  '🧸', '🧸',      99,     99,     49,  'love',    'pop',  3, '/animations/gifts/starter25/teddy.png',        'png', true, true),
  ('Ring',        '💍', '💍',    1500,   1500,    750,  'love',    'pop',  4, '/animations/gifts/starter25/ring.png',         'png', true, true),
  ('Angel Wings', '👼', '👼',    1999,   1999,    999,  'love',    'pop',  5, '/animations/gifts/starter25/angel-wings.png',  'png', true, true),
  ('Star',        '⭐', '⭐',       1,      1,      1,  'popular', 'pop',  6, '/animations/gifts/starter25/star.png',         'png', true, true),
  ('Panda',       '🐼', '🐼',      50,     50,     25,  'popular', 'pop',  7, '/animations/gifts/starter25/panda.png',        'png', true, true),
  ('TikTok',      '🎵', '🎵',     100,    100,     50,  'popular', 'pop',  8, '/animations/gifts/starter25/tiktok.png',       'png', true, true),
  ('Fireworks',   '🎆', '🎆',     199,    199,     99,  'popular', 'pop',  9, '/animations/gifts/starter25/fireworks.png',    'png', true, true),
  ('Ice Cream',   '🍦', '🍦',       5,      5,      2,  'popular', 'pop', 10, '/animations/gifts/starter25/ice-cream.png',    'png', true, true),
  ('Pizza',       '🍕', '🍕',      10,     10,      5,  'popular', 'pop', 11, '/animations/gifts/starter25/pizza.png',        'png', true, true),
  ('Birthday Cake','🎂','🎂',      50,     50,     25,  'popular', 'pop', 12, '/animations/gifts/starter25/cake.png',         'png', true, true),
  ('Money Gun',   '💸', '💸',     999,    999,    499,  'luxury',  'pop', 13, '/animations/gifts/starter25/money-gun.png',    'png', true, true),
  ('Diamond',     '💎', '💎',     499,    499,    249,  'luxury',  'pop', 14, '/animations/gifts/starter25/diamond.png',      'png', true, true),
  ('Crown',       '👑', '👑',    4999,   4999,   2499,  'luxury',  'pop', 15, '/animations/gifts/starter25/crown.png',        'png', true, true),
  ('Rocket',      '🚀', '🚀',     499,    499,    249,  'luxury',  'pop', 16, '/animations/gifts/starter25/rocket.png',       'png', true, true),
  ('Sports Car',  '🏎', '🏎',    6999,   6999,   3499,  'luxury',  'pop', 17, '/animations/gifts/starter25/sports-car.png',   'png', true, true),
  ('Luxury Yacht','🛥', '🛥',    9999,   9999,   4999,  'luxury',  'pop', 18, '/animations/gifts/starter25/yacht.png',        'png', true, true),
  ('Magic Castle','🏰', '🏰',   19999,  19999,   9999,  'luxury',  'pop', 19, '/animations/gifts/starter25/castle.png',       'png', true, true),
  ('Galaxy',      '🌌', '🌌',    2999,   2999,   1499,  'mythic',  'pop', 20, '/animations/gifts/starter25/galaxy.png',       'png', true, true),
  ('Universe',    '🌠', '🌠',   34999,  34999,  17499,  'mythic',  'pop', 21, '/animations/gifts/starter25/universe.png',     'png', true, true),
  ('Unicorn',     '🦄', '🦄',    7999,   7999,   3999,  'mythic',  'pop', 22, '/animations/gifts/starter25/unicorn.png',      'png', true, true),
  ('Phoenix',     '🔥', '🔥',   11999,  11999,   5999,  'mythic',  'pop', 23, '/animations/gifts/starter25/phoenix.png',      'png', true, true),
  ('Dragon',      '🐲', '🐲',   14999,  14999,   7499,  'mythic',  'pop', 24, '/animations/gifts/starter25/dragon.png',       'png', true, true),
  ('Lion King',   '🦁', '🦁',   29999,  29999,  14999,  'mythic',  'pop', 25, '/animations/gifts/starter25/lion.png',         'png', true, true)
)
INSERT INTO public.gifts (name, emoji, icon, price, price_coins, diamonds_value, category, animation, sort_order, clip_path, clip_type, is_active, active)
SELECT name, emoji, icon, price, price_coins, diamonds_value, category, animation, sort_order, clip_path, clip_type, is_active, active
FROM data
ON CONFLICT (name) DO UPDATE SET
  emoji          = EXCLUDED.emoji,
  icon           = EXCLUDED.icon,
  price          = EXCLUDED.price,
  price_coins    = EXCLUDED.price_coins,
  diamonds_value = EXCLUDED.diamonds_value,
  category       = EXCLUDED.category,
  animation      = EXCLUDED.animation,
  sort_order     = EXCLUDED.sort_order,
  clip_path      = EXCLUDED.clip_path,
  clip_type      = EXCLUDED.clip_type,
  is_active      = EXCLUDED.is_active,
  active         = EXCLUDED.active;

COMMIT;
