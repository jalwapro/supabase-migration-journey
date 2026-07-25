-- 0173 Real illustrated luxury pack — 25 premium PNG gifts.
BEGIN;

WITH data(name, emoji, icon, price, price_coins, diamonds_value, category, animation, sort_order, clip_path, clip_type, is_active, active) AS (
  VALUES
  ('Luxury Watch',        '⌚', '⌚',   3499,   3499,   1749, 'luxury',  'pop',  30, '/animations/gifts/luxury25/rolex.png',        'png', true, true),
  ('Supercar',            '🏎', '🏎',   7999,   7999,   3999, 'luxury',  'pop',  31, '/animations/gifts/luxury25/lambo.png',        'png', true, true),
  ('Private Jet',         '✈️', '✈️', 14999,  14999,   7499, 'luxury',  'pop',  32, '/animations/gifts/luxury25/jet.png',          'png', true, true),
  ('Luxury Mansion',      '🏠', '🏠', 19999,  19999,   9999, 'luxury',  'pop',  33, '/animations/gifts/luxury25/mansion.png',      'png', true, true),
  ('Gold Bars',           '🪙', '🪙',  2499,   2499,   1249, 'luxury',  'pop',  34, '/animations/gifts/luxury25/gold-bars.png',    'png', true, true),
  ('Cash Stack',          '💵', '💵',  1499,   1499,    749, 'luxury',  'pop',  35, '/animations/gifts/luxury25/cash-stack.png',   'png', true, true),
  ('Champagne Pop',       '🍾', '🍾',  2499,   2499,   1249, 'luxury',  'pop',  36, '/animations/gifts/luxury25/champagne.png',   'png', true, true),
  ('Black Card',          '💳', '💳',  3999,   3999,   1999, 'luxury',  'pop',  37, '/animations/gifts/luxury25/black-card.png',   'png', true, true),
  ('Diamond Bracelet',    '💎', '💎',  2999,   2999,   1499, 'luxury',  'pop',  38, '/animations/gifts/luxury25/bracelet.png',    'png', true, true),
  ('Diamond Earrings',    '💎', '💎',  2799,   2799,   1399, 'luxury',  'pop',  39, '/animations/gifts/luxury25/earrings.png',    'png', true, true),
  ('Diamond Necklace',    '💎', '💎',  4499,   4499,   2249, 'luxury',  'pop',  40, '/animations/gifts/luxury25/necklace.png',    'png', true, true),
  ('Designer Handbag',    '👜', '👜',  3299,   3299,   1649, 'luxury',  'pop',  41, '/animations/gifts/luxury25/handbag.png',     'png', true, true),
  ('Luxury Perfume',      '🧴', '🧴',  1899,   1899,    949, 'luxury',  'pop',  42, '/animations/gifts/luxury25/perfume.png',     'png', true, true),
  ('Royal Lipstick',      '💄', '💄',   999,    999,    499, 'luxury',  'pop',  43, '/animations/gifts/luxury25/lipstick.png',    'png', true, true),
  ('Winner Trophy',       '🏆', '🏆',  2999,   2999,   1499, 'premium', 'pop',  44, '/animations/gifts/luxury25/trophy.png',      'png', true, true),
  ('Gold Medal',          '🏅', '🏅',  2499,   2499,   1249, 'premium', 'pop',  45, '/animations/gifts/luxury25/medal.png',       'png', true, true),
  ('Royal Scepter',       '🪄', '🪄',  5999,   5999,   2999, 'premium', 'pop',  46, '/animations/gifts/luxury25/scepter.png',     'png', true, true),
  ('Royal Throne',        '👑', '👑', 12999,  12999,   6499, 'premium', 'pop',  47, '/animations/gifts/luxury25/throne.png',      'png', true, true),
  ('Treasure Chest',      '💰', '💰',  6999,   6999,   3499, 'premium', 'pop',  48, '/animations/gifts/luxury25/treasure.png',    'png', true, true),
  ('Gold Coins',          '🪙', '🪙',   799,    799,    399, 'premium', 'pop',  49, '/animations/gifts/luxury25/gold-coins.png',  'png', true, true),
  ('Pink Diamond Ring',   '💍', '💍',  4999,   4999,   2499, 'luxury',  'pop',  50, '/animations/gifts/luxury25/pink-diamond.png', 'png', true, true),
  ('Red Helicopter',      '🚁', '🚁',  8999,   8999,   4499, 'luxury',  'pop',  51, '/animations/gifts/luxury25/helicopter.png',  'png', true, true),
  ('Sports Bike',         '🏍️', '🏍️', 3999,   3999,   1999, 'luxury',  'pop',  52, '/animations/gifts/luxury25/motorbike.png',   'png', true, true),
  ('Gold Chain',          '⛓️', '⛓️', 2799,   2799,   1399, 'luxury',  'pop',  53, '/animations/gifts/luxury25/gold-chain.png',  'png', true, true),
  ('Crystal Cluster',     '💠', '💠', 5499,   5499,   2749, 'premium', 'pop',  54, '/animations/gifts/luxury25/gem-cluster.png', 'png', true, true)
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
