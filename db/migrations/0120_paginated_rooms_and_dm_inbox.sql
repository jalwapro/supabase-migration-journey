-- Scale fix: server-side pagination + aggregation for hot list endpoints.
--
-- Before:
--   /rooms          .limit(200) + second query for popularity + client sort
--   /messages inbox .limit(300) DMs pulled to browser to build peer index
--
-- After:
--   list_live_rooms_ranked(_limit, _offset)  — pre-joined + sorted + paginated
--   dm_inbox(_limit, _offset)                — one row per peer, server-aggregated
--
-- Impact: a user with thousands of DMs now transfers ~50 rows instead of 300
-- and the missing-conversation bug (peer whose last message was #301) is
-- fixed. Rooms list scales past 200 live rooms and drops the client-side
-- popularity join.

-- ---------- live rooms, ranked + paginated -------------------------------
CREATE OR REPLACE FUNCTION public.list_live_rooms_ranked(
  _limit int DEFAULT 30,
  _offset int DEFAULT 0
) RETURNS TABLE (
  id uuid,
  title text,
  cover_url text,
  room_type text,
  viewer_count int,
  is_locked boolean,
  host_username text,
  host_avatar text,
  coin_score bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.title,
    r.cover_url,
    r.room_type::text,
    r.viewer_count,
    r.is_locked,
    p.username,
    p.avatar,
    COALESCE(pop.coin_score, 0)::bigint
  FROM public.live_rooms r
  LEFT JOIN public.profiles p         ON p.id = r.host_id
  LEFT JOIN public.room_popularity pop ON pop.room_id = r.id
  WHERE r.status = 'live'
  ORDER BY COALESCE(pop.coin_score, 0) DESC, r.viewer_count DESC, r.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 100))
  OFFSET GREATEST(0, _offset)
$$;

GRANT EXECUTE ON FUNCTION public.list_live_rooms_ranked(int, int) TO anon, authenticated;

-- ---------- DM inbox, aggregated + paginated ------------------------------
CREATE OR REPLACE FUNCTION public.dm_inbox(
  _limit int DEFAULT 50,
  _offset int DEFAULT 0
) RETURNS TABLE (
  peer_id uuid,
  peer_username text,
  peer_avatar text,
  peer_user_code text,
  last_message text,
  last_kind text,
  last_deleted boolean,
  last_created_at timestamptz,
  unread int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  msgs AS (
    SELECT
      CASE WHEN dm.sender_id = (SELECT uid FROM me)
           THEN dm.recipient_id ELSE dm.sender_id END AS peer_id,
      dm.message,
      dm.kind,
      dm.created_at,
      dm.read_at,
      dm.deleted_at,
      dm.recipient_id
    FROM public.direct_messages dm
    WHERE dm.sender_id    = (SELECT uid FROM me)
       OR dm.recipient_id = (SELECT uid FROM me)
  ),
  latest AS (
    SELECT DISTINCT ON (peer_id)
      peer_id, message, kind, deleted_at, created_at
    FROM msgs
    ORDER BY peer_id, created_at DESC
  ),
  unread AS (
    SELECT peer_id, COUNT(*)::int AS n
    FROM msgs
    WHERE recipient_id = (SELECT uid FROM me) AND read_at IS NULL
    GROUP BY peer_id
  )
  SELECT
    l.peer_id,
    p.username,
    p.avatar,
    p.user_code,
    l.message,
    l.kind,
    l.deleted_at IS NOT NULL,
    l.created_at,
    COALESCE(u.n, 0)
  FROM latest l
  LEFT JOIN public.profiles p ON p.id = l.peer_id
  LEFT JOIN unread u          ON u.peer_id = l.peer_id
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 100))
  OFFSET GREATEST(0, _offset)
$$;

GRANT EXECUTE ON FUNCTION public.dm_inbox(int, int) TO authenticated;

-- Supporting indexes (idempotent).
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_created
  ON public.direct_messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_rooms_status
  ON public.live_rooms (status) WHERE status = 'live';

NOTIFY pgrst, 'reload schema';
