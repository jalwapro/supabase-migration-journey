-- 0379: Track active room presence separately from persistent room/member records.
-- A membership row can survive an abrupt browser close; only a fresh heartbeat
-- qualifies a user as currently present in a room.
ALTER TABLE public.room_members
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_room_members_active_presence
  ON public.room_members (room_id, last_seen_at DESC);

-- Do not backfill old rows: stale sessions must not be counted as online.
NOTIFY pgrst, 'reload schema';
