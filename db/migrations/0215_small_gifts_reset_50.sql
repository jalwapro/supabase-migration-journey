-- Reset small tier: soft-deactivate all existing gifts with price between 1..300
-- (Money Gun stays — price=0). Then insert 50 fresh small gifts (10..300 coins)
-- all pointing to local SVG files that are known to render (like Lollipop).

BEGIN;

-- 1) Soft-delete old small gifts
UPDATE public.gifts
   SET is_active = false, active = false
 WHERE price BETWEEN 1 AND 300;

-- 2) Insert 50 new small gifts
INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation,
   clip_path, clip_type, image_url, sort_order, is_active, active, chromakey)
VALUES
  ('Lollipop',        '🍭', '🍭',  10,   10,   6,   'classic', 'pop', '/animations/gifts/basic/lollipop.svg',    'svg', '/animations/gifts/basic/lollipop.svg',    1,  true, true, 'none'),
  ('Thumbs Up',       '👍', '👍',  12,   12,   7,   'popular', 'pop', '/animations/gifts/basic/like.svg',        'svg', '/animations/gifts/basic/like.svg',        2,  true, true, 'none'),
  ('Little Heart',    '❤️',  '❤️',   15,   15,   9,   'love',    'pop', '/animations/gifts/basic/heart.svg',       'svg', '/animations/gifts/basic/heart.svg',       3,  true, true, 'none'),
  ('Rose',            '🌹', '🌹',  18,   18,   11,  'love',    'pop', '/animations/gifts/basic/rose.svg',        'svg', '/animations/gifts/basic/rose.svg',        4,  true, true, 'none'),
  ('Donut',           '🍩', '🍩',  20,   20,   12,  'classic', 'pop', '/animations/gifts/basic/donut.svg',       'svg', '/animations/gifts/basic/donut.svg',       5,  true, true, 'none'),
  ('Candy',           '🍬', '🍬',  22,   22,   13,  'classic', 'pop', '/animations/gifts/basic/candy.svg',       'svg', '/animations/gifts/basic/candy.svg',       6,  true, true, 'none'),
  ('Pizza Slice',     '🍕', '🍕',  25,   25,   15,  'classic', 'pop', '/animations/gifts/basic/pizza.svg',       'svg', '/animations/gifts/basic/pizza.svg',       7,  true, true, 'none'),
  ('Confetti',        '🎊', '🎊',  28,   28,   17,  'popular', 'burst','/animations/gifts/basic/confetti.svg',    'svg', '/animations/gifts/basic/confetti.svg',    8,  true, true, 'none'),
  ('Balloon',         '🎈', '🎈',  30,   30,   18,  'popular', 'pop', '/animations/gifts/basic/balloon.svg',     'svg', '/animations/gifts/basic/balloon.svg',     9,  true, true, 'none'),
  ('Ice Cream',       '🍦', '🍦',  35,   35,   21,  'classic', 'pop', '/animations/gifts/basic/icecream.svg',    'svg', '/animations/gifts/basic/icecream.svg',    10, true, true, 'none'),
  ('Coffee',          '☕', '☕',  40,   40,   24,  'classic', 'pop', '/animations/gifts/basic/coffee.svg',      'svg', '/animations/gifts/basic/coffee.svg',      11, true, true, 'none'),
  ('Chocolate',       '🍫', '🍫',  45,   45,   27,  'classic', 'pop', '/animations/gifts/basic/chocolate.svg',   'svg', '/animations/gifts/basic/chocolate.svg',   12, true, true, 'none'),
  ('Wine Glass',      '🍷', '🍷',  50,   50,   30,  'classic', 'pop', '/animations/gifts/basic/wine.svg',        'svg', '/animations/gifts/basic/wine.svg',        13, true, true, 'none'),
  ('Sweet Kiss',      '💋', '💋',  55,   55,   33,  'love',    'pop', '/animations/gifts/basic/kiss.svg',        'svg', '/animations/gifts/basic/kiss.svg',        14, true, true, 'none'),
  ('Cloud Heart',     '☁️',  '☁️',   60,   60,   36,  'love',    'pop', '/animations/gifts/basic/cloudheart.svg',  'svg', '/animations/gifts/basic/cloudheart.svg',  15, true, true, 'none'),
  ('Teddy Bear',      '🧸', '🧸',  65,   65,   39,  'classic', 'pop', '/animations/gifts/basic/teddy.svg',       'svg', '/animations/gifts/basic/teddy.svg',       16, true, true, 'none'),
  ('Sunflower',       '🌻', '🌻',  70,   70,   42,  'popular', 'pop', '/animations/gifts/basic/sunflower.svg',   'svg', '/animations/gifts/basic/sunflower.svg',   17, true, true, 'none'),
  ('Mini Cake',       '🎂', '🎂',  75,   75,   45,  'popular', 'pop', '/animations/gifts/basic/cake.svg',        'svg', '/animations/gifts/basic/cake.svg',        18, true, true, 'none'),
  ('Music Note',      '🎵', '🎵',  80,   80,   48,  'popular', 'pop', '/animations/gifts/basic/musicnote.svg',   'svg', '/animations/gifts/basic/musicnote.svg',   19, true, true, 'none'),
  ('Butterfly',       '🦋', '🦋',  85,   85,   51,  'popular', 'pop', '/animations/gifts/basic/butterfly.svg',   'svg', '/animations/gifts/basic/butterfly.svg',   20, true, true, 'none'),
  ('Bunny',           '🐰', '🐰',  90,   90,   54,  'popular', 'pop', '/animations/gifts/basic/bunny.svg',       'svg', '/animations/gifts/basic/bunny.svg',       21, true, true, 'none'),
  ('Gift Box',        '🎁', '🎁',  95,   95,   57,  'popular', 'pop', '/animations/gifts/basic/giftbox.svg',     'svg', '/animations/gifts/basic/giftbox.svg',     22, true, true, 'none'),
  ('Star',            '⭐', '⭐',  100,  100,  60,  'popular', 'pop', '/animations/gifts/basic/star.svg',        'svg', '/animations/gifts/basic/star.svg',        23, true, true, 'none'),
  ('Snowflake',       '❄️',  '❄️',   110,  110,  66,  'classic', 'pop', '/animations/gifts/basic/snowflake.svg',   'svg', '/animations/gifts/basic/snowflake.svg',   24, true, true, 'none'),
  ('Fire',            '🔥', '🔥',  120,  120,  72,  'popular', 'pop', '/animations/gifts/basic/fire.svg',        'svg', '/animations/gifts/basic/fire.svg',        25, true, true, 'none'),
  ('Rainbow',         '🌈', '🌈',  130,  130,  78,  'popular', 'pop', '/animations/gifts/basic/rainbow.svg',     'svg', '/animations/gifts/basic/rainbow.svg',     26, true, true, 'none'),
  ('Sky Lantern',     '🏮', '🏮',  140,  140,  84,  'popular', 'pop', '/animations/gifts/basic/skylantern.svg',  'svg', '/animations/gifts/basic/skylantern.svg',  27, true, true, 'none'),
  ('Love Letter',     '💌', '💌',  150,  150,  90,  'love',    'pop', '/animations/gifts/basic/loveletter.svg',  'svg', '/animations/gifts/basic/loveletter.svg',  28, true, true, 'none'),
  ('Ring',            '💍', '💍',  160,  160,  96,  'love',    'pop', '/animations/gifts/basic/ring.svg',        'svg', '/animations/gifts/basic/ring.svg',        29, true, true, 'none'),
  ('Magic Wand',      '✨', '✨',  170,  170,  102, 'popular', 'pop', '/animations/gifts/basic/magicwand.svg',   'svg', '/animations/gifts/basic/magicwand.svg',   30, true, true, 'none'),
  ('Trophy',          '🏆', '🏆',  180,  180,  108, 'vip',     'pop', '/animations/gifts/basic/trophy.svg',      'svg', '/animations/gifts/basic/trophy.svg',      31, true, true, 'none'),
  ('Rocket',          '🚀', '🚀',  190,  190,  114, 'vip',     'pop', '/animations/gifts/basic/rocket.svg',      'svg', '/animations/gifts/basic/rocket.svg',      32, true, true, 'none'),
  ('Crown',           '👑', '👑',  200,  200,  120, 'vip',     'pop', '/animations/gifts/basic/crown.svg',       'svg', '/animations/gifts/basic/crown.svg',       33, true, true, 'none'),
  ('Crystal Heart',   '💎', '💎',  210,  210,  126, 'love',    'pop', '/animations/gifts/basic/crystalheart.svg','svg', '/animations/gifts/basic/crystalheart.svg',34, true, true, 'none'),
  ('Emerald',         '💚', '💚',  220,  220,  132, 'vip',     'pop', '/animations/gifts/basic/emerald.svg',     'svg', '/animations/gifts/basic/emerald.svg',     35, true, true, 'none'),
  ('Party Popper',    '🎉', '🎉',  225,  225,  135, 'popular', 'burst','/animations/gifts/basic/confetti.svg',    'svg', '/animations/gifts/basic/confetti.svg',    36, true, true, 'none'),
  ('Cupcake',         '🧁', '🧁',  230,  230,  138, 'classic', 'pop', '/animations/gifts/basic/cake.svg',        'svg', '/animations/gifts/basic/cake.svg',        37, true, true, 'none'),
  ('Rose Bouquet',    '💐', '💐',  235,  235,  141, 'love',    'pop', '/animations/gifts/basic/rose.svg',        'svg', '/animations/gifts/basic/rose.svg',        38, true, true, 'none'),
  ('Diamond Star',    '🌟', '🌟',  240,  240,  144, 'vip',     'pop', '/animations/gifts/basic/star.svg',        'svg', '/animations/gifts/basic/star.svg',        39, true, true, 'none'),
  ('Firework',        '🎆', '🎆',  245,  245,  147, 'popular', 'burst','/animations/gifts/basic/fire.svg',        'svg', '/animations/gifts/basic/fire.svg',        40, true, true, 'none'),
  ('Music Beat',      '🎶', '🎶',  250,  250,  150, 'popular', 'pop', '/animations/gifts/basic/musicnote.svg',   'svg', '/animations/gifts/basic/musicnote.svg',   41, true, true, 'none'),
  ('Rainbow Heart',   '💖', '💖',  255,  255,  153, 'love',    'pop', '/animations/gifts/basic/rainbow.svg',     'svg', '/animations/gifts/basic/rainbow.svg',     42, true, true, 'none'),
  ('Snow Star',       '❆',  '❆',   260,  260,  156, 'classic', 'pop', '/animations/gifts/basic/snowflake.svg',   'svg', '/animations/gifts/basic/snowflake.svg',   43, true, true, 'none'),
  ('Lucky Box',       '🎁', '🎁',  265,  265,  159, 'popular', 'pop', '/animations/gifts/basic/giftbox.svg',     'svg', '/animations/gifts/basic/giftbox.svg',     44, true, true, 'none'),
  ('Angel Kiss',      '😇', '😇',  270,  270,  162, 'love',    'pop', '/animations/gifts/basic/kiss.svg',        'svg', '/animations/gifts/basic/kiss.svg',        45, true, true, 'none'),
  ('Sparkle Wand',    '💫', '💫',  275,  275,  165, 'popular', 'pop', '/animations/gifts/basic/magicwand.svg',   'svg', '/animations/gifts/basic/magicwand.svg',   46, true, true, 'none'),
  ('Royal Cup',       '🏅', '🏅',  280,  280,  168, 'vip',     'pop', '/animations/gifts/basic/trophy.svg',      'svg', '/animations/gifts/basic/trophy.svg',      47, true, true, 'none'),
  ('Golden Ring',     '💍', '💍',  285,  285,  171, 'love',    'pop', '/animations/gifts/basic/ring.svg',        'svg', '/animations/gifts/basic/ring.svg',        48, true, true, 'none'),
  ('Dream Cloud',     '💭', '💭',  290,  290,  174, 'love',    'pop', '/animations/gifts/basic/cloudheart.svg',  'svg', '/animations/gifts/basic/cloudheart.svg',  49, true, true, 'none'),
  ('Sweet Dream',     '💗', '💗',  300,  300,  180, 'love',    'pop', '/animations/gifts/basic/crystalheart.svg','svg', '/animations/gifts/basic/crystalheart.svg',50, true, true, 'none');

COMMIT;

NOTIFY pgrst, 'reload schema';
