-- Replace basic gifts (price 1..300) with new 3D glossy chibi-style illustrations
-- matching the reference app style (Corgi, Cat Claw Cup, Money Tree, etc.)

BEGIN;

-- Remove old basic gifts (keep Money Gun at price 0)
DELETE FROM public.gifts WHERE price BETWEEN 1 AND 300;

INSERT INTO public.gifts (name, emoji, price, diamonds_value, category, animation, sort_order, is_active, icon_path, chromakey)
VALUES
  ('Lollipop',          '🍭', 10,  10,  'classic', 'pop', 10,  true, '/gifts/basic-3d/lollipop.png',          'none'),
  ('Rose',              '🌹', 18,  18,  'love',    'pop', 20,  true, '/gifts/basic-3d/rose.png',              'none'),
  ('Sweet Love',        '💘', 20,  20,  'love',    'pop', 30,  true, '/gifts/basic-3d/sweet-love.png',        'none'),
  ('Donut',             '🍩', 25,  25,  'classic', 'pop', 40,  true, '/gifts/basic-3d/donut.png',             'none'),
  ('Ice Cream',         '🍦', 35,  35,  'classic', 'pop', 50,  true, '/gifts/basic-3d/ice-cream.png',         'none'),
  ('Mini Cake',         '🎂', 45,  45,  'classic', 'pop', 60,  true, '/gifts/basic-3d/mini-cake.png',         'none'),
  ('Cat Claw Cup',      '🥥', 55,  55,  'popular', 'pop', 70,  true, '/gifts/basic-3d/cat-claw-cup.png',      'none'),
  ('Pink Headphones',   '🎧', 70,  70,  'popular', 'pop', 80,  true, '/gifts/basic-3d/pink-headphones.png',   'none'),
  ('Balloon',           '🎈', 85,  85,  'popular', 'pop', 90,  true, '/gifts/basic-3d/balloon.png',           'none'),
  ('Happy Puppy',       '🐕', 100, 100, 'popular', 'pop', 100, true, '/gifts/basic-3d/happy-puppy.png',       'none'),
  ('Little Bear',       '🐻', 120, 120, 'popular', 'pop', 110, true, '/gifts/basic-3d/little-bear.png',       'none'),
  ('Corgi',             '🐶', 140, 140, 'popular', 'pop', 120, true, '/gifts/basic-3d/corgi.png',             'none'),
  ('Confession Letter', '💌', 160, 160, 'love',    'pop', 130, true, '/gifts/basic-3d/confession-letter.png', 'none'),
  ('Chocolate Box',     '🍫', 180, 180, 'love',    'pop', 140, true, '/gifts/basic-3d/chocolate.png',         'none'),
  ('Typewriter',        '⌨️', 200, 200, 'love',    'pop', 150, true, '/gifts/basic-3d/typewriter.png',        'none'),
  ('Aladdin Lamp',      '🪔', 220, 220, 'vip',     'pop', 160, true, '/gifts/basic-3d/aladdin-lamp.png',      'none'),
  ('Royal Crown',       '👑', 240, 240, 'vip',     'pop', 170, true, '/gifts/basic-3d/crown.png',             'none'),
  ('Love Ring',         '💍', 260, 260, 'love',    'pop', 180, true, '/gifts/basic-3d/love-ring.png',         'none'),
  ('Crystal Ball',      '🔮', 280, 280, 'love',    'pop', 190, true, '/gifts/basic-3d/crystal-ball.png',      'none'),
  ('Money Tree',        '🌳', 300, 300, 'vip',     'pop', 200, true, '/gifts/basic-3d/money-tree.png',        'none');

COMMIT;
