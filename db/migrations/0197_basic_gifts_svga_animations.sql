-- 0197: Attach real SVGA animations to the 15 basic gifts.
-- Sources: svga/SVGA-Samples + svga/SVGAPlayer-Web tests/samples (already in
-- public/animations/gifts/svga/). Each PNG thumbnail is preserved for the
-- gift sheet, but the room player now plays a real SVGA (canvas) animation.
BEGIN;

WITH data(name, svga) AS (VALUES
  ('Heart',       '/animations/gifts/svga/heart.svga'),
  ('Like',        '/animations/gifts/svga/TwitterHeart.svga'),
  ('Rose',        '/animations/gifts/svga/rose.svga'),
  ('Chocolate',   '/animations/gifts/svga/giftbox.svga'),
  ('Teddy Bear',  '/animations/gifts/svga/angel.svga'),
  ('Balloon',     '/animations/gifts/svga/heartbeat.svga'),
  ('Candy',       '/animations/gifts/svga/rose.svga'),
  ('Ice Cream',   '/animations/gifts/svga/giftbox.svga'),
  ('Coffee',      '/animations/gifts/svga/giftbox.svga'),
  ('Diamond Ring','/animations/gifts/svga/crown.svga'),
  ('Cake',        '/animations/gifts/svga/halloween.svga'),
  ('Fire',        '/animations/gifts/svga/Rocket.svga'),
  ('Kiss',        '/animations/gifts/svga/TwitterHeart.svga'),
  ('Star',        '/animations/gifts/svga/angel.svga'),
  ('Butterfly',   '/animations/gifts/svga/heartbeat.svga')
)
UPDATE public.gifts g
   SET clip_path = d.svga,
       clip_type = 'svga',
       animation = 'pop',
       is_active = true,
       active    = true
  FROM data d
 WHERE g.name = d.name;

COMMIT;
