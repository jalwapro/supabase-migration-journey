-- ============================================================================
-- 0147_rankings_categories.sql
-- Unified rankings RPC covering every category shown on the /rank page:
--   wealth  = profiles.coins
--   points  = profiles.xp
--   charm   = distinct fans (senders) who gifted the user in period
--   hosts   = coins received via gifts in period
--   gifters = coins spent on gifts in period
--   pk      = PK matches won in period
--   vip     = profiles.vip_level (tie-break by coins)
--   royals  = profiles.vip_level >= 10 (top tier only)
--   popular = coins received (proxy for popularity) in period
--   country = same as wealth, filtered by scope
--
-- Scopes: 'global' | 'country' (p_scope_value = ISO country) | 'family' (family_id::text)
-- Periods: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all'
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_coins       ON public.profiles (coins DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_profiles_xp          ON public.profiles (xp DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_profiles_vip_level   ON public.profiles (vip_level DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_pk_matches_winner    ON public.pk_matches (winner_id, ended_at);

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
  WITH agg AS (
    SELECT p.id AS uid, (
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
    FROM public.profiles p
    LEFT JOIN public.family_members fm ON fm.user_id = p.id
    WHERE (p_scope = 'global'
        OR (p_scope = 'country' AND p.country = p_scope_value)
        OR (p_scope = 'family'  AND fm.family_id::text = p_scope_value))
      AND (lower(p_category) <> 'royals' OR COALESCE(p.vip_level,0) >= 10)
  )
  SELECT a.uid,
         p.username,
         p.avatar,
         p.country,
         COALESCE(p.vip_level,0)::int,
         COALESCE(p.level,1)::int,
         a.s,
         ROW_NUMBER() OVER (ORDER BY a.s DESC, p.id) AS rnk
    FROM agg a
    JOIN public.profiles p ON p.id = a.uid
   WHERE a.s > 0
   ORDER BY a.s DESC
   LIMIT GREATEST(p_limit, 1);
END $$;

GRANT EXECUTE ON FUNCTION public.rank_users(text,text,text,text,int) TO anon, authenticated;

-- Personal rank for the "My Rank" sticky card.
CREATE OR REPLACE FUNCTION public.rank_me(
  p_category    text DEFAULT 'wealth',
  p_period      text DEFAULT 'all',
  p_scope       text DEFAULT 'global',
  p_scope_value text DEFAULT NULL
) RETURNS TABLE (
  user_id uuid, username text, avatar text, country text,
  vip_level int, level int, score bigint, rnk bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.user_id, r.username, r.avatar, r.country, r.vip_level, r.level, r.score, r.rnk
    FROM public.rank_users(p_category, p_period, p_scope, p_scope_value, 100000) r
   WHERE r.user_id = auth.uid()
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.rank_me(text,text,text,text) TO authenticated;
