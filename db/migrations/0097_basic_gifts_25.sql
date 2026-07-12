-- Jalwa Basic Gifts collection (25 SVGs) matching reference image
BEGIN;

-- Remove any old duplicates by name so re-runs stay clean
DELETE FROM public.gifts WHERE name IN (
  'Heart','Like','Rose','Chocolate','Teddy','Balloon','Candy','Ice Cream','Coffee','Ring',
  'Cake','Fire','Kiss','Star','Butterfly','Gift Box','Love Letter','Crystal Heart','Snowflake','Rainbow',
  'Crown','Magic Wand','Sky Lantern','Confetti','Rocket'
);

INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation, sort_order, clip_path, clip_type, is_active, active)
VALUES
  ('Heart','❤️','❤️',1,1,1,'popular','pop',1,'/animations/gifts/basic/heart.svg','svg',true,true),
  ('Like','👍','👍',1,1,1,'popular','pop',2,'/animations/gifts/basic/like.svg','svg',true,true),
  ('Rose','🌹','🌹',1,1,1,'love','pop',3,'/animations/gifts/basic/rose.svg','svg',true,true),
  ('Chocolate','🍫','🍫',2,2,1,'classic','pop',4,'/animations/gifts/basic/chocolate.svg','svg',true,true),
  ('Teddy','🧸','🧸',2,2,1,'classic','pop',5,'/animations/gifts/basic/teddy.svg','svg',true,true),
  ('Balloon','🎈','🎈',2,2,1,'popular','pop',6,'/animations/gifts/basic/balloon.svg','svg',true,true),
  ('Candy','🍭','🍭',3,3,2,'classic','pop',7,'/animations/gifts/basic/candy.svg','svg',true,true),
  ('Ice Cream','🍦','🍦',3,3,2,'classic','pop',8,'/animations/gifts/basic/icecream.svg','svg',true,true),
  ('Coffee','☕','☕',3,3,2,'classic','pop',9,'/animations/gifts/basic/coffee.svg','svg',true,true),
  ('Ring','💍','💍',5,5,3,'luxury','pop',10,'/animations/gifts/basic/ring.svg','svg',true,true),
  ('Cake','🎂','🎂',5,5,3,'popular','pop',11,'/animations/gifts/basic/cake.svg','svg',true,true),
  ('Fire','🔥','🔥',5,5,3,'popular','pop',12,'/animations/gifts/basic/fire.svg','svg',true,true),
  ('Kiss','💋','💋',5,5,3,'love','pop',13,'/animations/gifts/basic/kiss.svg','svg',true,true),
  ('Star','⭐','⭐',5,5,3,'popular','pop',14,'/animations/gifts/basic/star.svg','svg',true,true),
  ('Butterfly','🦋','🦋',6,6,3,'popular','pop',15,'/animations/gifts/basic/butterfly.svg','svg',true,true),
  ('Gift Box','🎁','🎁',6,6,3,'popular','pop',16,'/animations/gifts/basic/giftbox.svg','svg',true,true),
  ('Love Letter','💌','💌',6,6,3,'love','pop',17,'/animations/gifts/basic/loveletter.svg','svg',true,true),
  ('Crystal Heart','💎','💎',8,8,4,'luxury','pop',18,'/animations/gifts/basic/crystalheart.svg','svg',true,true),
  ('Snowflake','❄️','❄️',8,8,4,'popular','pop',19,'/animations/gifts/basic/snowflake.svg','svg',true,true),
  ('Rainbow','🌈','🌈',8,8,4,'popular','pop',20,'/animations/gifts/basic/rainbow.svg','svg',true,true),
  ('Crown','👑','👑',10,10,5,'luxury','pop',21,'/animations/gifts/basic/crown.svg','svg',true,true),
  ('Magic Wand','🪄','🪄',10,10,5,'premium','pop',22,'/animations/gifts/basic/magicwand.svg','svg',true,true),
  ('Sky Lantern','🏮','🏮',10,10,5,'popular','pop',23,'/animations/gifts/basic/skylantern.svg','svg',true,true),
  ('Confetti','🎉','🎉',10,10,5,'popular','pop',24,'/animations/gifts/basic/confetti.svg','svg',true,true),
  ('Rocket','🚀','🚀',15,15,7,'premium','pop',25,'/animations/gifts/basic/rocket.svg','svg',true,true);

COMMIT;
