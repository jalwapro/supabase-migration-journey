-- Jalwa Basic Gifts collection (25 SVGs) — safe upsert (no deletes, preserves gift_sends FKs)
BEGIN;

WITH data(name, emoji, price, category, sort_order, clip_path) AS (VALUES
  ('Heart','❤️',1,'popular',1,'/animations/gifts/basic/heart.svg'),
  ('Like','👍',1,'popular',2,'/animations/gifts/basic/like.svg'),
  ('Rose','🌹',1,'love',3,'/animations/gifts/basic/rose.svg'),
  ('Chocolate','🍫',2,'classic',4,'/animations/gifts/basic/chocolate.svg'),
  ('Teddy','🧸',2,'classic',5,'/animations/gifts/basic/teddy.svg'),
  ('Balloon','🎈',2,'popular',6,'/animations/gifts/basic/balloon.svg'),
  ('Candy','🍭',3,'classic',7,'/animations/gifts/basic/candy.svg'),
  ('Ice Cream','🍦',3,'classic',8,'/animations/gifts/basic/icecream.svg'),
  ('Coffee','☕',3,'classic',9,'/animations/gifts/basic/coffee.svg'),
  ('Ring','💍',5,'luxury',10,'/animations/gifts/basic/ring.svg'),
  ('Cake','🎂',5,'popular',11,'/animations/gifts/basic/cake.svg'),
  ('Fire','🔥',5,'popular',12,'/animations/gifts/basic/fire.svg'),
  ('Kiss','💋',5,'love',13,'/animations/gifts/basic/kiss.svg'),
  ('Star','⭐',5,'popular',14,'/animations/gifts/basic/star.svg'),
  ('Butterfly','🦋',6,'popular',15,'/animations/gifts/basic/butterfly.svg'),
  ('Gift Box','🎁',6,'popular',16,'/animations/gifts/basic/giftbox.svg'),
  ('Love Letter','💌',6,'love',17,'/animations/gifts/basic/loveletter.svg'),
  ('Crystal Heart','💎',8,'luxury',18,'/animations/gifts/basic/crystalheart.svg'),
  ('Snowflake','❄️',8,'popular',19,'/animations/gifts/basic/snowflake.svg'),
  ('Rainbow','🌈',8,'popular',20,'/animations/gifts/basic/rainbow.svg'),
  ('Crown','👑',10,'luxury',21,'/animations/gifts/basic/crown.svg'),
  ('Magic Wand','🪄',10,'premium',22,'/animations/gifts/basic/magicwand.svg'),
  ('Sky Lantern','🏮',10,'popular',23,'/animations/gifts/basic/skylantern.svg'),
  ('Confetti','🎉',10,'popular',24,'/animations/gifts/basic/confetti.svg'),
  ('Rocket','🚀',15,'premium',25,'/animations/gifts/basic/rocket.svg')
),
upd AS (
  UPDATE public.gifts g
     SET emoji = d.emoji, icon = d.emoji, price = d.price, price_coins = d.price,
         category = d.category, sort_order = d.sort_order,
         clip_path = d.clip_path, clip_type = 'svg', animation = 'pop',
         is_active = true, active = true, image_url = NULL
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
