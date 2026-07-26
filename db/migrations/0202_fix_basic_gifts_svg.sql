-- 0202: Revert the 15 basic gifts from mismatched SVGA files back to their
-- own themed SVG animations that live in /animations/gifts/basic/*.svg.
-- Migration 0197 had mapped unrelated svga samples (e.g. Fire→Rocket.svga,
-- Balloon→heartbeat.svga, Chocolate/Ice Cream/Coffee all → giftbox.svga).
-- Those either rendered wrong content or blank canvases in the room player.
-- Every path below is present under public/animations/gifts/basic/.
BEGIN;

WITH data(name, svg) AS (VALUES
  ('Heart',        '/animations/gifts/basic/heart.svg'),
  ('Like',         '/animations/gifts/basic/like.svg'),
  ('Rose',         '/animations/gifts/basic/rose.svg'),
  ('Chocolate',    '/animations/gifts/basic/chocolate.svg'),
  ('Teddy Bear',   '/animations/gifts/basic/teddy.svg'),
  ('Balloon',      '/animations/gifts/basic/balloon.svg'),
  ('Candy',        '/animations/gifts/basic/candy.svg'),
  ('Ice Cream',    '/animations/gifts/basic/icecream.svg'),
  ('Coffee',       '/animations/gifts/basic/coffee.svg'),
  ('Diamond Ring', '/animations/gifts/basic/ring.svg'),
  ('Cake',         '/animations/gifts/basic/cake.svg'),
  ('Fire',         '/animations/gifts/basic/fire.svg'),
  ('Kiss',         '/animations/gifts/basic/kiss.svg'),
  ('Star',         '/animations/gifts/basic/star.svg'),
  ('Butterfly',    '/animations/gifts/basic/butterfly.svg')
)
UPDATE public.gifts g
   SET clip_path = d.svg,
       clip_type = 'svg',
       image_url = d.svg,
       animation = 'pop',
       is_active = true,
       active    = true
  FROM data d
 WHERE g.name = d.name;

COMMIT;
