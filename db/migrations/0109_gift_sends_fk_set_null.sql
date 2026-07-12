-- Allow deleting gifts from the admin panel without losing gift_sends history.
-- The existing FK gift_sends.gift_id -> gifts.id has no ON DELETE action, so
-- any DELETE/UPDATE on gifts referenced by past sends fails with:
--   update or delete on table "gifts" violates foreign key constraint
--   "gift_sends_gift_id_fkey" on table "gift_sends"
--
-- Recreate the FK with ON DELETE SET NULL so history rows are preserved
-- (coins_spent / diamonds_earned stay), but the gift reference is cleared
-- when an admin removes the gift. gift_id must be nullable for this.

ALTER TABLE public.gift_sends
  ALTER COLUMN gift_id DROP NOT NULL;

ALTER TABLE public.gift_sends
  DROP CONSTRAINT IF EXISTS gift_sends_gift_id_fkey;

ALTER TABLE public.gift_sends
  ADD CONSTRAINT gift_sends_gift_id_fkey
  FOREIGN KEY (gift_id) REFERENCES public.gifts(id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Same treatment for milestone_gift_sends if it exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='milestone_gift_sends'
  ) THEN
    EXECUTE 'ALTER TABLE public.milestone_gift_sends ALTER COLUMN gift_id DROP NOT NULL';
    EXECUTE 'ALTER TABLE public.milestone_gift_sends DROP CONSTRAINT IF EXISTS milestone_gift_sends_gift_id_fkey';
    EXECUTE 'ALTER TABLE public.milestone_gift_sends
             ADD CONSTRAINT milestone_gift_sends_gift_id_fkey
             FOREIGN KEY (gift_id) REFERENCES public.gifts(id)
             ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;
