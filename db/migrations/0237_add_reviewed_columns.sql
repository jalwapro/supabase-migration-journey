-- Add missing reviewed_by / reviewed_at columns referenced by
-- approve_recharge, reject_recharge, and withdrawal RPCs.
-- Discovered via e2e flow tests (tests/e2e/flows.test.sql).

ALTER TABLE public.recharge_requests
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Backfill from processed_at for historical rows so admin UIs render.
UPDATE public.recharge_requests
   SET reviewed_at = processed_at
 WHERE reviewed_at IS NULL AND processed_at IS NOT NULL;

UPDATE public.withdrawal_requests
   SET reviewed_at = processed_at
 WHERE reviewed_at IS NULL AND processed_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
