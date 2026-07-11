-- Delete all gifts seeded by the AI (clears gift box and admin panel gift list)
-- Note: gift_sends / user history references may cascade; if FK RESTRICT, clear children first.

BEGIN;

-- Clear dependent history tables that reference gifts (best-effort; ignore if tables don't exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='gift_sends') THEN
    EXECUTE 'DELETE FROM public.gift_sends';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='milestone_gift_sends') THEN
    EXECUTE 'DELETE FROM public.milestone_gift_sends';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='gift_leaderboard_daily') THEN
    EXECUTE 'DELETE FROM public.gift_leaderboard_daily';
  END IF;
END $$;

DELETE FROM public.gifts;

COMMIT;
