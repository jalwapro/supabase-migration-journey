-- Add TikTok-style gift categories with animated SVG clips.
-- clip_path stores the animated preview URL (relative /animations/gifts/*.svg).
-- clip_type='svg' for these; existing 'mp4' default stays untouched.

-- 1) Attach animations to existing gifts and normalize categories.
UPDATE public.gifts SET clip_path='/animations/gifts/rose-bloom.svg', clip_type='svg', category='love',        sort_order=1 WHERE name='Rose';
UPDATE public.gifts SET clip_path='/animations/gifts/heart-burst.svg', clip_type='svg', category='love',       sort_order=2 WHERE name='Heart' AND EXISTS (SELECT 1);
UPDATE public.gifts SET clip_path='/animations/gifts/fireworks.svg',   clip_type='svg', category='popular',    sort_order=3 WHERE name='Fireworks';
UPDATE public.gifts SET clip_path='/animations/gifts/diamond-sparkle.svg', clip_type='svg', category='luxury', sort_order=1 WHERE name='Diamond';
UPDATE public.gifts SET clip_path='/animations/gifts/rocket-launch.svg',   clip_type='svg', category='luxury', sort_order=2 WHERE name='Sports Car';
UPDATE public.gifts SET clip_path='/animations/gifts/crown-shine.svg',     clip_type='svg', category='vip',    sort_order=2 WHERE name='Crown';
UPDATE public.gifts SET clip_path='/animations/gifts/galaxy-swirl.svg',    clip_type='svg', category='vip',    sort_order=3 WHERE name='Unicorn';
UPDATE public.gifts SET clip_path='/animations/gifts/phoenix.svg',         clip_type='svg', category='vip',    sort_order=4 WHERE name='Dragon';
UPDATE public.gifts SET clip_path='/animations/gifts/crown-shine.svg',     clip_type='svg', category='vip',    sort_order=5 WHERE name='Castle';

-- 2) Insert new gifts across the six categories. Idempotent by name.
INSERT INTO public.gifts (name, emoji, icon, price, price_coins, diamonds_value, category, animation, clip_path, clip_type, sort_order, is_active, active)
VALUES
  -- popular
  ('Hi',           '👋',  '👋',   1,    1,    1,    'popular', 'pop',     NULL,                                        'svg', 0,  true, true),
  ('Ice Cream',    '🍦',  '🍦',   5,    5,    3,    'popular', 'pop',     NULL,                                        'svg', 1,  true, true),
  ('Confetti',     '🎉',  '🎉',   50,   50,   30,   'popular', 'burst',   '/animations/gifts/fireworks.svg',           'svg', 4,  true, true),
  ('Coin Rain',    '🪙',  '🪙',   199,  199,  120,  'popular', 'rain',    '/animations/gifts/coin-rain.svg',           'svg', 5,  true, true),

  -- love
  ('Heart',        '❤️',   '❤️',    9,    9,    5,    'love',    'pulse',   '/animations/gifts/heart-burst.svg',         'svg', 3,  true, true),
  ('Kiss',         '💋',  '💋',   29,   29,   18,   'love',    'pulse',   '/animations/gifts/heart-burst.svg',         'svg', 4,  true, true),
  ('Love Letter',  '💌',  '💌',   99,   99,   60,   'love',    'float',   '/animations/gifts/heart-burst.svg',         'svg', 5,  true, true),
  ('Cupid Arrow',  '🏹',  '🏹',   299,  299,  180,  'love',    'shoot',   '/animations/gifts/heart-burst.svg',         'svg', 6,  true, true),

  -- luxury
  ('Champagne',    '🍾',  '🍾',   250,  250,  150,  'luxury',  'pop',     '/animations/gifts/fireworks.svg',           'svg', 3,  true, true),
  ('Yacht',        '🛥️', '🛥️',   3000, 3000, 1800, 'luxury',  'slide',   '/animations/gifts/rocket-launch.svg',       'svg', 4,  true, true),
  ('Sports Car+',  '🏎️', '🏎️',   1500, 1500, 900,  'luxury',  'zoom',    '/animations/gifts/rocket-launch.svg',       'svg', 5,  true, true),

  -- vip
  ('Rocket',       '🚀',  '🚀',   1999, 1999, 1200, 'vip',     'launch',  '/animations/gifts/rocket-launch.svg',       'svg', 1,  true, true),
  ('Galaxy',       '🌌',  '🌌',   6000, 6000, 3600, 'vip',     'swirl',   '/animations/gifts/galaxy-swirl.svg',        'svg', 6,  true, true),
  ('Phoenix',      '🔥',  '🔥',   9999, 9999, 6000, 'vip',     'flame',   '/animations/gifts/phoenix.svg',             'svg', 7,  true, true),

  -- lucky
  ('Lucky Box',    '🎁',  '🎁',   100,  100,  60,   'lucky',   'shake',   '/animations/gifts/lucky-box.svg',           'svg', 1,  true, true),
  ('Mega Box',     '📦',  '📦',   500,  500,  300,  'lucky',   'shake',   '/animations/gifts/lucky-box.svg',           'svg', 2,  true, true),
  ('Diamond Box',  '💠',  '💠',   1200, 1200, 720,  'lucky',   'shake',   '/animations/gifts/diamond-sparkle.svg',     'svg', 3,  true, true),

  -- classic
  ('Star',         '⭐',  '⭐',   20,   20,   12,   'classic', 'twinkle', '/animations/gifts/fireworks.svg',           'svg', 1,  true, true),
  ('Cake',         '🎂',  '🎂',   66,   66,   40,   'classic', 'pop',     NULL,                                        'svg', 2,  true, true),
  ('Trophy',       '🏆',  '🏆',   799,  799,  480,  'classic', 'shine',   '/animations/gifts/crown-shine.svg',         'svg', 3,  true, true)
ON CONFLICT DO NOTHING;

-- 3) Delete any zero-name duplicates just in case; safe no-op otherwise.
-- (No-op guard.)
