-- Gifter level progression: every 1,000,000 coins spent on gifts = +1 level,
-- capped at 100. Level N requires N million total gifted. Also mirrors the
-- remaining coins-in-current-level into profiles.xp so the profile progress
-- bar (LevelBadge / me.tsx) fills toward the next level.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS total_gifted_coins bigint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_total_gifted_coins
  ON public.profiles (total_gifted_coins DESC);

-- Trigger: after each gift_sends insert, add coins_spent to sender's
-- total_gifted_coins and recompute their level + xp progress.
CREATE OR REPLACE FUNCTION public.tg_gift_sender_level_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_total bigint;
  new_level int;
  new_xp    bigint;
BEGIN
  IF NEW.sender_id IS NULL OR COALESCE(NEW.coins_spent, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles
     SET total_gifted_coins = COALESCE(total_gifted_coins, 0) + NEW.coins_spent
   WHERE id = NEW.sender_id
   RETURNING total_gifted_coins INTO new_total;

  IF new_total IS NULL THEN
    RETURN NEW;
  END IF;

  new_level := LEAST(100, GREATEST(0, (new_total / 1000000)::int));
  new_xp    := new_total % 1000000;

  UPDATE public.profiles
     SET level = new_level,
         xp    = new_xp
   WHERE id = NEW.sender_id
     AND (level IS DISTINCT FROM new_level OR xp IS DISTINCT FROM new_xp);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gift_sender_level_progress ON public.gift_sends;
CREATE TRIGGER trg_gift_sender_level_progress
  AFTER INSERT ON public.gift_sends
  FOR EACH ROW EXECUTE FUNCTION public.tg_gift_sender_level_progress();

-- Backfill existing gifters from historical gift_sends.
WITH agg AS (
  SELECT sender_id, SUM(coins_spent)::bigint AS total
    FROM public.gift_sends
   WHERE sender_id IS NOT NULL
   GROUP BY sender_id
)
UPDATE public.profiles p
   SET total_gifted_coins = agg.total,
       level = LEAST(100, GREATEST(0, (agg.total / 1000000)::int)),
       xp    = agg.total % 1000000
  FROM agg
 WHERE p.id = agg.sender_id;
