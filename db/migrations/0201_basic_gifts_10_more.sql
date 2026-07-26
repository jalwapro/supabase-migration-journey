-- 10 more basic animated SVG gifts (safe upsert)
BEGIN;

WITH data(name, emoji, price, category, sort_order, clip_path) AS (VALUES
  ('Lollipop',    '🍭', 8,  'classic', 30, '/animations/gifts/basic/lollipop.svg'),
  ('Donut',       '🍩', 12, 'classic', 31, '/animations/gifts/basic/donut.svg'),
  ('Sunflower',   '🌻', 15, 'popular', 32, '/animations/gifts/basic/sunflower.svg'),
  ('Pizza Slice', '🍕', 18, 'classic', 33, '/animations/gifts/basic/pizza.svg'),
  ('Bunny',       '🐰', 20, 'popular', 34, '/animations/gifts/basic/bunny.svg'),
  ('Music Note',  '🎵', 22, 'popular', 35, '/animations/gifts/basic/musicnote.svg'),
  ('Wine Glass',  '🍷', 28, 'classic', 36, '/animations/gifts/basic/wine.svg'),
  ('Cloud Heart', '☁️', 30, 'love',    37, '/animations/gifts/basic/cloudheart.svg'),
  ('Emerald',     '💚', 55, 'luxury',  38, '/animations/gifts/basic/emerald.svg'),
  ('Trophy',      '🏆', 75, 'luxury',  39, '/animations/gifts/basic/trophy.svg')
),
upd AS (
  UPDATE public.gifts g
     SET emoji=d.emoji, icon=d.emoji, price=d.price, price_coins=d.price,
         diamonds_value=GREATEST(1, d.price/2),
         category=d.category, sort_order=d.sort_order,
         clip_path=d.clip_path, clip_type='svg', image_url=NULL,
         animation='pop', is_active=true, active=true
    FROM data d
   WHERE g.name = d.name
  RETURNING g.name
)
INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation, sort_order, clip_path, clip_type, is_active, active)
SELECT d.name, d.emoji, d.emoji, d.price, d.price, GREATEST(1, d.price/2), d.category, 'pop', d.sort_order, d.clip_path, 'svg', true, true
  FROM data d
 WHERE d.name NOT IN (SELECT name FROM upd);

COMMIT;
