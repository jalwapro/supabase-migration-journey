-- Gift-received summaries for public profiles and VoiceRoom member popups.
-- Read-only aggregate RPC; existing gift send/payment functions are unchanged.
CREATE OR REPLACE FUNCTION public.get_user_gift_received_stats(
  _user_id uuid,
  _today_start timestamptz,
  _month_start timestamptz
)
RETURNS TABLE (
  period text,
  total_coins bigint,
  total_diamonds bigint,
  gift_count bigint,
  top_supporters jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF _user_id IS NULL OR _today_start IS NULL OR _month_start IS NULL THEN
    RAISE EXCEPTION 'user and period boundaries are required';
  END IF;

  RETURN QUERY
  WITH periods AS (
    SELECT 'today'::text AS period, _today_start AS start_at
    UNION ALL
    SELECT 'month'::text, _month_start
    UNION ALL
    SELECT 'all_time'::text, NULL::timestamptz
  ),
  scoped AS (
    SELECT p.period,
           gs.sender_id,
           COALESCE(gs.coins_spent, 0)::bigint AS coins_spent,
           COALESCE(gs.diamonds_earned, 0)::bigint AS diamonds_earned,
           COALESCE(gs.quantity, 0)::bigint AS quantity
    FROM periods p
    JOIN public.gift_sends gs
      ON gs.receiver_id = _user_id
     AND (p.start_at IS NULL OR gs.created_at >= p.start_at)
     -- The owner can see their full history. Other viewers only see gift rows
     -- from live rooms that are unlocked or that they currently belong to.
     AND (
       auth.uid() = _user_id
       OR (
         gs.room_id IS NOT NULL
         AND EXISTS (
           SELECT 1
           FROM public.live_rooms r
           WHERE r.id = gs.room_id
             AND r.status = 'live'
             AND (
               NOT COALESCE(r.is_locked, false)
               OR r.host_id = auth.uid()
               OR EXISTS (
                 SELECT 1 FROM public.room_members m
                 WHERE m.room_id = r.id AND m.user_id = auth.uid()
               )
             )
         )
       )
     )
  ),
  totals AS (
    SELECT s.period,
           COALESCE(SUM(s.coins_spent), 0)::bigint AS total_coins,
           COALESCE(SUM(s.diamonds_earned), 0)::bigint AS total_diamonds,
           COALESCE(SUM(s.quantity), 0)::bigint AS gift_count
    FROM scoped s
    GROUP BY s.period
  ),
  supporter_totals AS (
    SELECT s.period, s.sender_id,
           SUM(s.coins_spent)::bigint AS points,
           SUM(s.quantity)::bigint AS gifts
    FROM scoped s
    WHERE s.sender_id <> _user_id
    GROUP BY s.period, s.sender_id
  ),
  ranked_supporters AS (
    SELECT st.*,
           ROW_NUMBER() OVER (
             PARTITION BY st.period
             ORDER BY st.points DESC, st.gifts DESC, st.sender_id
           ) AS supporter_rank
    FROM supporter_totals st
  ),
  supporters AS (
    SELECT rs.period,
           jsonb_agg(
             jsonb_build_object(
               'user_id', rs.sender_id,
               'username', COALESCE(pr.username, pr.full_name, 'User'),
               'avatar', pr.avatar,
               'points', rs.points,
               'gifts', rs.gifts
             )
             ORDER BY rs.points DESC, rs.gifts DESC, rs.sender_id
           ) AS top_supporters
    FROM ranked_supporters rs
    LEFT JOIN public.profiles pr ON pr.id = rs.sender_id
    WHERE rs.supporter_rank <= 10
    GROUP BY rs.period
  )
  SELECT p.period,
         COALESCE(t.total_coins, 0)::bigint,
         COALESCE(t.total_diamonds, 0)::bigint,
         COALESCE(t.gift_count, 0)::bigint,
         COALESCE(s.top_supporters, '[]'::jsonb)
  FROM periods p
  LEFT JOIN totals t ON t.period = p.period
  LEFT JOIN supporters s ON s.period = p.period
  ORDER BY CASE p.period WHEN 'today' THEN 1 WHEN 'month' THEN 2 ELSE 3 END;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_gift_received_stats(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_gift_received_stats(uuid, timestamptz, timestamptz) TO authenticated;
