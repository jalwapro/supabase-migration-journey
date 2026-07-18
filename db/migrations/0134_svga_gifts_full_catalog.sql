-- 0134: Add full SVGA gift catalog (admin can delete unwanted ones later)
BEGIN;

-- Wipe current catalog + related history to avoid FK conflicts
DELETE FROM public.gift_sends;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='milestone_gift_sends') THEN
    EXECUTE 'DELETE FROM public.milestone_gift_sends';
  END IF;
END $$;
DELETE FROM public.gifts;

INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation,
   sort_order, is_active, active, clip_path, clip_type, image_url, sound_url)
VALUES
  ('Porsche',      '🏎️', '🏎️', 1999, 1999, 1000, 'luxury',   'burst', 10, true, true, '/animations/gifts/svga/posche.svga',    'svga', NULL, NULL),
  ('Ferrari',      '🏎️', '🏎️', 1999, 1999, 1000, 'luxury',   'burst', 15, true, true, '/animations/gifts/svga/ferrari.svga',   'svga', NULL, NULL),
  ('Rocket',       '🚀', '🚀', 2999, 2999, 1500, 'luxury',   'burst', 20, true, true, '/animations/gifts/svga/Rocket.svga',    'svga', NULL, NULL),
  ('Royal Crown',  '👑', '👑',  999,  999,  500, 'luxury',   'burst', 30, true, true, '/animations/gifts/svga/kingset.svga',   'svga', NULL, NULL),
  ('Golden Crown', '👑', '👑', 1499, 1499,  750, 'luxury',   'burst', 35, true, true, '/animations/gifts/svga/crown.svga',     'svga', NULL, NULL),
  ('Angel Wings',  '👼', '👼',  899,  899,  450, 'luxury',   'burst', 40, true, true, '/animations/gifts/svga/angel.svga',     'svga', NULL, NULL),
  ('Halloween',    '🎃', '🎃',  799,  799,  400, 'luxury',   'burst', 50, true, true, '/animations/gifts/svga/halloween.svga', 'svga', NULL, NULL),
  ('Gift Box',     '🎁', '🎁',  499,  499,  250, 'popular',  'burst', 60, true, true, '/animations/gifts/svga/giftbox.svga',   'svga', NULL, NULL),
  ('Rose Bloom',   '🌹', '🌹',  299,  299,  150, 'romantic', 'burst', 70, true, true, '/animations/gifts/svga/rose.svga',      'svga', NULL, NULL),
  ('Heartbeat',    '💗', '💗',  199,  199,  100, 'romantic', 'burst', 80, true, true, '/animations/gifts/svga/heartbeat.svga', 'svga', NULL, NULL),
  ('Twitter Heart','❤️', '❤️',   99,   99,   50, 'romantic', 'burst', 90, true, true, '/animations/gifts/svga/heart.svga',     'svga', NULL, NULL);

COMMIT;
