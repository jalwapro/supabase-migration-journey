-- 0198 TikTok-style unique animated gifts (10)
BEGIN;

INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation, sort_order, is_active, active, clip_path, clip_type, image_url)
VALUES
  ('Rose Tornado',       '🌹', '🌹',   199,   199,   100, 'romantic', 'burst', 9101, true, true, '/animations/gifts/tt-unique-1-rose-tornado.svg',     'svg', NULL),
  ('Diamond Rain',       '💎', '💎',   499,   499,   250, 'luxury',   'burst', 9102, true, true, '/animations/gifts/tt-unique-2-diamond-rain.svg',     'svg', NULL),
  ('Swan Heart',         '🦢', '🦢',   299,   299,   150, 'romantic', 'burst', 9103, true, true, '/animations/gifts/tt-unique-3-swan-heart.svg',       'svg', NULL),
  ('Unicorn Magic',      '🦄', '🦄',   699,   699,   350, 'fantasy',  'burst', 9104, true, true, '/animations/gifts/tt-unique-4-unicorn-magic.svg',    'svg', NULL),
  ('Panda Love',         '🐼', '🐼',    99,    99,    50, 'cute',     'pop',   9105, true, true, '/animations/gifts/tt-unique-5-panda-love.svg',       'svg', NULL),
  ('Ferrari Drift',      '🏎️', '🏎️', 1499,  1499,   750, 'luxury',   'burst', 9106, true, true, '/animations/gifts/tt-unique-6-ferrari-drift.svg',    'svg', NULL),
  ('Money Shower',       '🤑', '🤑',   999,   999,   500, 'luxury',   'burst', 9107, true, true, '/animations/gifts/tt-unique-7-money-shower.svg',     'svg', NULL),
  ('Castle Fireworks',   '🏰', '🏰',  1999,  1999,  1000, 'luxury',   'burst', 9108, true, true, '/animations/gifts/tt-unique-8-castle-fireworks.svg', 'svg', NULL),
  ('Phoenix Rise',       '🦅', '🦅',  2999,  2999,  1500, 'mythic',   'burst', 9109, true, true, '/animations/gifts/tt-unique-9-phoenix-rise.svg',     'svg', NULL),
  ('Cosmic Yacht',       '🛥️', '🛥️', 3999,  3999,  2000, 'luxury',   'burst', 9110, true, true, '/animations/gifts/tt-unique-10-cosmic-yacht.svg',    'svg', NULL)
ON CONFLICT (name) DO UPDATE SET
  clip_path      = EXCLUDED.clip_path,
  clip_type      = EXCLUDED.clip_type,
  image_url      = NULL,
  price          = EXCLUDED.price,
  price_coins    = EXCLUDED.price_coins,
  diamonds_value = EXCLUDED.diamonds_value,
  category       = EXCLUDED.category,
  animation      = EXCLUDED.animation,
  sort_order     = EXCLUDED.sort_order,
  is_active      = true,
  active         = true;

COMMIT;
