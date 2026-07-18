-- 0131: Wipe all existing gifts and seed fresh SVGA-only gift catalog
BEGIN;

-- Clear history so FK constraints don't block deletion
DELETE FROM public.gift_sends;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='milestone_gift_sends') THEN
    EXECUTE 'DELETE FROM public.milestone_gift_sends';
  END IF;
END $$;

DELETE FROM public.gifts;

-- Seed SVGA gifts (true-transparent, TikTok/Bigo style)
INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation,
   sort_order, is_active, active, clip_path, clip_type, image_url, sound_url)
VALUES
  ('Porsche',      '🏎️', '🏎️', 1999, 1999, 1000, 'luxury',   'burst', 10, true, true, '/animations/gifts/svga/posche.svga',         'svga', NULL, NULL),
  ('Royal Crown',  '👑', '👑',  999,  999,  500, 'luxury',   'burst', 20, true, true, '/animations/gifts/svga/kingset.svga',        'svga', NULL, NULL),
  ('Heartbeat',    '💗', '💗',  199,  199,  100, 'romantic', 'burst', 30, true, true, '/animations/gifts/svga/heartbeat.svga',      'svga', NULL, NULL),
  ('Rose Bloom',   '🌹', '🌹',  299,  299,  150, 'romantic', 'burst', 40, true, true, '/animations/frames/svga/rose.svga',          'svga', NULL, NULL),
  ('Angel Wings',  '👼', '👼',  599,  599,  300, 'luxury',   'burst', 50, true, true, '/animations/frames/svga/angel.svga',         'svga', NULL, NULL),
  ('Rocket',       '🚀', '🚀', 2999, 2999, 1500, 'luxury',   'burst', 60, true, true, '/animations/gifts/svga/Rocket.svga',         'svga', NULL, NULL),
  ('Pin Jump',     '📍', '📍',   99,   99,   50, 'popular',  'burst', 70, true, true, '/animations/gifts/svga/PinJump.svga',        'svga', NULL, NULL),
  ('Halloween',    '🎃', '🎃',  799,  799,  400, 'luxury',   'burst', 80, true, true, '/animations/frames/svga/halloween.svga',     'svga', NULL, NULL),
  ('Hamburger',    '🍔', '🍔',   29,   29,   15, 'popular',  'burst', 90, true, true, '/animations/gifts/svga/HamburgerArrow.svga', 'svga', NULL, NULL),
  ('Empty Love',   '📭', '📭',   49,   49,   25, 'popular',  'burst',100, true, true, '/animations/gifts/svga/EmptyState.svga',     'svga', NULL, NULL);

COMMIT;
