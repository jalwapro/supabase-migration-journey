BEGIN;

-- Restore the room_top_gifters RPC used by GiftSheet. The original migration
-- exists in the repository but the live database had drifted and returned 404.
CREATE OR REPLACE FUNCTION public.room_top_gifters(
  _room_id uuid,
  _limit integer DEFAULT 20
)
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar text,
  total_coins bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    gs.sender_id AS user_id,
    p.username,
    p.avatar,
    COALESCE(SUM(gs.coins_spent), 0)::bigint AS total_coins
  FROM public.gift_sends gs
  LEFT JOIN public.profiles p ON p.id = gs.sender_id
  WHERE gs.room_id = _room_id
    AND gs.sender_id IS NOT NULL
  GROUP BY gs.sender_id, p.username, p.avatar
  ORDER BY total_coins DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 20), 100));
$$;

REVOKE ALL ON FUNCTION public.room_top_gifters(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.room_top_gifters(uuid, integer) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
COMMIT;
