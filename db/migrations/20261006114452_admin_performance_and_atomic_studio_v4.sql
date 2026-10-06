-- Enforce admin authorization in live/report read RPCs.
CREATE OR REPLACE FUNCTION public.get_admin_live_rooms(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  id UUID,
  title TEXT,
  room_type TEXT,
  cover_url TEXT,
  viewer_count INTEGER,
  seat_count INTEGER,
  host_id UUID,
  created_at TIMESTAMPTZ,
  coin_score NUMERIC,
  username TEXT,
  avatar TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id, r.title, r.room_type::text, r.cover_url, r.viewer_count, r.seat_count,
    r.host_id, r.created_at, COALESCE(p.coin_score,0),
    u.username, u.avatar
  FROM public.live_rooms r
  LEFT JOIN public.room_popularity p ON p.room_id = r.id
  LEFT JOIN public.profiles u ON u.id = r.host_id
  WHERE r.status = 'live' AND public.room_layout_admin()
  ORDER BY COALESCE(p.coin_score,0) DESC, COALESCE(r.viewer_count,0) DESC, r.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 200));
$$;

REVOKE ALL ON FUNCTION public.get_admin_live_rooms(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_live_rooms(INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_reports(
  p_status TEXT,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  reporter_id UUID,
  reporter_username TEXT,
  reporter_avatar TEXT,
  reported_user_id UUID,
  reported_username TEXT,
  reported_avatar TEXT,
  room_id UUID,
  room_title TEXT,
  reason TEXT,
  details TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.reporter_id, rp.username, rp.avatar,
         r.reported_user_id, tp.username, tp.avatar,
         r.room_id, lr.title, r.reason, r.details, r.status, r.created_at
  FROM public.user_reports r
  LEFT JOIN public.profiles rp ON rp.id = r.reporter_id
  LEFT JOIN public.profiles tp ON tp.id = r.reported_user_id
  LEFT JOIN public.live_rooms lr ON lr.id = r.room_id
  WHERE r.status = p_status AND public.room_layout_admin()
  ORDER BY r.created_at DESC, r.id DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100))
  OFFSET GREATEST(0, p_offset);
$$;

REVOKE ALL ON FUNCTION public.get_admin_reports(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_reports(TEXT, INTEGER, INTEGER) TO authenticated;

