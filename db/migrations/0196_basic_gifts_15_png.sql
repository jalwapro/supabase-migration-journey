-- 15 basic gifts with variable prices using CDN PNG assets
BEGIN;

WITH data(name, emoji, price, category, sort_order, image_url) AS (VALUES
  ('Heart',      '❤️',   10,  'popular', 10, '/__l5e/assets-v1/5dcd7cc8-b347-4c61-b970-8fe641051105/heart.png'),
  ('Like',       '👍',    5,  'popular', 11, '/__l5e/assets-v1/75d61559-a8b4-4ddd-bd14-d65e6a24b1ce/like.png'),
  ('Rose',       '🌹',   20,  'love',    12, '/__l5e/assets-v1/4af0c801-50c2-4724-9d3f-f6acae6b2fdd/rose.png'),
  ('Chocolate',  '🍫',   30,  'classic', 13, '/__l5e/assets-v1/4e611eb1-1f9b-4a5d-bcf6-7f8533e59421/chocolate.png'),
  ('Teddy Bear', '🧸',   50,  'classic', 14, '/__l5e/assets-v1/3741f1e8-c105-4dbb-bd33-519c1af11cc3/teddy.png'),
  ('Balloon',    '🎈',   15,  'popular', 15, '/__l5e/assets-v1/55fc54c4-02d1-4d27-bacf-b29a9922589b/balloon.png'),
  ('Candy',      '🍭',   25,  'classic', 16, '/__l5e/assets-v1/beab77f6-5897-403a-aef4-e06bc733afd3/candy.png'),
  ('Ice Cream',  '🍦',   35,  'classic', 17, '/__l5e/assets-v1/1de12a77-e195-4ac9-89c2-8204022c10c8/icecream.png'),
  ('Coffee',     '☕',   40,  'classic', 18, '/__l5e/assets-v1/5ac7e989-46cc-4b13-92b0-d2b885d71289/coffee.png'),
  ('Diamond Ring','💍', 500,  'luxury',  19, '/__l5e/assets-v1/bbbab963-e2ad-4ab2-9146-2977d21e79df/ring.png'),
  ('Cake',       '🎂',   80,  'popular', 20, '/__l5e/assets-v1/4adf051b-bdad-4cc8-a588-961a5ff1cfdc/cake.png'),
  ('Fire',       '🔥',   60,  'popular', 21, '/__l5e/assets-v1/2f9ede74-b806-49b4-8be5-a3077dbd06f5/fire.png'),
  ('Kiss',       '💋',   45,  'love',    22, '/__l5e/assets-v1/17e0e4a0-4962-4126-88f7-4b715028f4c1/kiss.png'),
  ('Star',       '⭐',   70,  'popular', 23, '/__l5e/assets-v1/fa3d1fd5-0617-426e-b04c-5e76999f0261/star.png'),
  ('Butterfly',  '🦋',   90,  'popular', 24, '/__l5e/assets-v1/f57b6adf-81ab-447b-b355-f9915da2616c/butterfly.png')
),
upd AS (
  UPDATE public.gifts g
     SET emoji=d.emoji, icon=d.emoji, price=d.price, price_coins=d.price,
         diamonds_value=GREATEST(1, d.price/2),
         category=d.category, sort_order=d.sort_order,
         image_url=d.image_url, clip_path=NULL, clip_type='image',
         animation='pop', is_active=true, active=true
    FROM data d
   WHERE g.name = d.name
  RETURNING g.name
)
INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation, sort_order, image_url, clip_type, is_active, active)
SELECT d.name, d.emoji, d.emoji, d.price, d.price, GREATEST(1, d.price/2), d.category, 'pop', d.sort_order, d.image_url, 'image', true, true
  FROM data d
 WHERE d.name NOT IN (SELECT name FROM upd);

COMMIT;
