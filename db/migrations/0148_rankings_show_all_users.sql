-- ============================================================================
-- 0148_rankings_show_all_users.sql
-- Fix: /rank page abhi sirf wo users dikhata tha jinka score > 0 tha,
-- isliye fresh users (jinke coins/xp/gifts abhi 0 hain) list me nahi aate the.
-- Aur global scope me family LEFT JOIN se duplicate rows aa sakte the.
-- Ab sab registered users dikhenge, score 0 bhi ho to.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rank_users(
  p_category    text DEFAULT 'wealth',
  p_period      text DEFAULT 'all',
  p_scope       text DEFAULT 'global',
  p_scope_value text DEFAULT NULL,
  p_limit       int  DEFAULT 100
) RETURNS TABLE (
  user_id     uuid,
  username    text,
  avatar      text,
  country     text,
  vip_level   int,
  level       int,
  score       bigint,
  rnk         bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_start timestamptz := public.vip_period_start(p_period);
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT DISTINCT p.id AS uid
      FROM public.profiles p
      LEFT JOIN public.family_members fm ON fm.user_id = p.id
     WHERE (p_scope = 'global'
         OR (p_scope = 'country' AND p.country = p_scope_value)
         OR (p_scope = 'family'  AND fm.family_id::text = p_scope_value))
       AND (lower(p_category) <> 'royals' OR COALESCE(p.vip_level,0) >= 10)
  ),
  agg AS (
    SELECT b.uid, (
      CASE lower(p_category)
        WHEN 'wealth'  THEN COALESCE(p.coins,0)::bigint
        WHEN 'country' THEN COALESCE(p.coins,0)::bigint
        WHEN 'points'  THEN COALESCE(p.xp,0)::bigint
        WHEN 'vip'     THEN (COALESCE(p.vip_level,0)::bigint * 1000000 + LEAST(COALESCE(p.coins,0),999999))
        WHEN 'royals'  THEN (COALESCE(p.vip_level,0)::bigint * 1000000 + LEAST(COALESCE(p.coins,0),999999))
        WHEN 'hosts'   THEN COALESCE((SELECT SUM(g.coins_spent) FROM public.gift_sends g WHERE g.receiver_id = p.id AND g.created_at >= v_start),0)::bigint
        WHEN 'popular' THEN COALESCE((SELECT SUM(g.coins_spent) FROM public.gift_sends g WHERE g.receiver_id = p.id AND g.created_at >= v_start),0)::bigint
        WHEN 'charm'   THEN COALESCE((SELECT COUNT(DISTINCT g.sender_id) FROM public.gift_sends g WHERE g.receiver_id = p.id AND g.created_at >= v_start),0)::bigint
        WHEN 'gifters' THEN COALESCE((SELECT SUM(g.coins_spent) FROM public.gift_sends g WHERE g.sender_id   = p.id AND g.created_at >= v_start),0)::bigint
        WHEN 'pk'      THEN COALESCE((SELECT COUNT(*) FROM public.pk_matches m WHERE m.winner_id = p.id AND m.ended_at IS NOT NULL AND m.ended_at >= v_start),0)::bigint
        ELSE 0::bigint
      END
    ) AS s
      FROM base b
      JOIN public.profiles p ON p.id = b.uid
  )
  SELECT a.uid,
         p.username,
         p.avatar,
         p.country,
         COALESCE(p.vip_level,0)::int,
         COALESCE(p.level,1)::int,
         a.s,
         ROW_NUMBER() OVER (ORDER BY a.s DESC, p.created_at ASC, p.id) AS rnk
    FROM agg a
    JOIN public.profiles p ON p.id = a.uid
   ORDER BY a.s DESC, p.created_at ASC
   LIMIT GREATEST(p_limit, 1);
END $$;

GRANT EXECUTE ON FUNCTION public.rank_users(text,text,text,text,int) TO anon, authenticated;
