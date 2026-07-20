-- Include host_id in list_live_rooms_ranked so clients can filter by "friends who are live".
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
  host_id uuid,
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
    r.host_id,
    p.username,
    p.avatar,
    COALESCE(pop.coin_score, 0)::bigint
  FROM public.live_rooms r
  LEFT JOIN public.profiles p          ON p.id = r.host_id
  LEFT JOIN public.room_popularity pop ON pop.room_id = r.id
  WHERE r.status = 'live'
  ORDER BY COALESCE(pop.coin_score, 0) DESC, r.viewer_count DESC, r.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 100))
  OFFSET GREATEST(0, _offset)
$$;

GRANT EXECUTE ON FUNCTION public.list_live_rooms_ranked(int, int) TO anon, authenticated;
