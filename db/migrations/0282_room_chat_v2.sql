-- 0282: Voice room chat v2 — reply, mentions and client-side dedupe.
-- Adds reply metadata (denormalized so rendering needs no extra query),
-- a mentions array, and a client_id used to deduplicate the optimistic
-- echo against the realtime INSERT event.

ALTER TABLE public.room_messages
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.room_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reply_to_username text,
  ADD COLUMN IF NOT EXISTS reply_to_text text,
  ADD COLUMN IF NOT EXISTS mentions text[] NOT NULL DEFAULT '{}';

-- One row per client_id per room: a retried insert can never duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS uq_room_messages_client_id
  ON public.room_messages (room_id, client_id)
  WHERE client_id IS NOT NULL;

-- Backfill-safe: reply lookups from a message thread.
CREATE INDEX IF NOT EXISTS idx_room_messages_reply_to
  ON public.room_messages (reply_to_id)
  WHERE reply_to_id IS NOT NULL;

GRANT SELECT, INSERT ON public.room_messages TO authenticated;
GRANT SELECT ON public.room_messages TO anon;
GRANT ALL ON public.room_messages TO service_role;
