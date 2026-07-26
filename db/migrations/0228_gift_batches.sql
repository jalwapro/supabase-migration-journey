-- Gift batch grouping for admin bulk operations
ALTER TABLE public.gifts
  ADD COLUMN IF NOT EXISTS batch_name text,
  ADD COLUMN IF NOT EXISTS batch_created_at timestamptz;

CREATE INDEX IF NOT EXISTS gifts_batch_name_idx ON public.gifts (batch_name);
CREATE INDEX IF NOT EXISTS gifts_batch_created_at_idx ON public.gifts (batch_created_at DESC);
