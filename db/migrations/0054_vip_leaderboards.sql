-- ============================================================================
-- Jalwa VIP Leaderboards — Phase 5
-- Time-windowed + scope-filtered rankings backed by gift_sends aggregation.
-- Scopes: global, country, family. Periods: daily, weekly, monthly, yearly, all.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_gift_sends_created_sender   ON public.gift_sends (created_at, sender_id);
CREATE INDEX IF NOT EXISTS idx_gift_sends_created_receiver ON public.gift_sends (created_at, receiver_id);
CREATE INDEX IF NOT EXISTS idx_profiles_country            ON public.profiles (country);

CREATE OR REPLACE FUNCTION public.vip_period_start(p_period text)
RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(p_period)
    WHEN 'daily'   THEN date_trunc('day',   now())
    WHEN 'weekly'  THEN date_trunc('week',  now())
    WHEN 'monthly' THEN date_trunc('month', now())
    WHEN 'yearly'  THEN date_trunc('year',  now())
    ELSE 'epoch'::timestamptz
  END;
$$;

-- Helper: uid -> family_id (nullable)
CREATE OR REPLACE FUNCTION public.vip_user_family(p_user uuid)
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT family_id FROM public.family_members WHERE user_id = p_user LIMIT 1;
$$;

-- Top gifters (sender_id)
CREATE OR REPLACE FUNCTION public.rank_gifters(
  p_period text DEFAULT 'all',
  p_scope  text DEFAULT 'global',   -- 'global' | 'country' | 'family'
  p_scope_value text DEFAULT NULL,
  p_limit int DEFAULT 50
) RETURNS TABLE (
  user_id uuid, username text, avatar text, country text,
  vip_level int, total_coins bigint, rnk bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH agg AS (
    SELECT g.sender_id AS uid, SUM(g.coins_spent)::bigint AS total
      FROM public.gift_sends g
      JOIN public.profiles   p ON p.id = g.sender_id
 LEFT JOIN public.family_members fm ON fm.user_id = g.sender_id
     WHERE g.sender_id IS NOT NULL
       AND g.created_at >= public.vip_period_start(p_period)
       AND (p_scope = 'global'
            OR (p_scope = 'country' AND p.country = p_scope_value)
            OR (p_scope = 'family'  AND fm.family_id::text = p_scope_value))
     GROUP BY g.sender_id
  )
  SELECT a.uid, p.username, p.avatar, p.country, COALESCE(p.vip_level,0), a.total,
         ROW_NUMBER() OVER (ORDER BY a.total DESC) AS rnk
    FROM agg a JOIN public.profiles p ON p.id = a.uid
   ORDER BY a.total DESC
   LIMIT p_limit;
$$;

-- Top hosts (receiver_id)
CREATE OR REPLACE FUNCTION public.rank_hosts(
  p_period text DEFAULT 'all',
  p_scope  text DEFAULT 'global',
  p_scope_value text DEFAULT NULL,
  p_limit int DEFAULT 50
) RETURNS TABLE (
  user_id uuid, username text, avatar text, country text,
  vip_level int, total_coins bigint, rnk bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH agg AS (
    SELECT g.receiver_id AS uid, SUM(g.coins_spent)::bigint AS total
      FROM public.gift_sends g
      JOIN public.profiles   p ON p.id = g.receiver_id
 LEFT JOIN public.family_members fm ON fm.user_id = g.receiver_id
     WHERE g.receiver_id IS NOT NULL
       AND g.created_at >= public.vip_period_start(p_period)
       AND (p_scope = 'global'
            OR (p_scope = 'country' AND p.country = p_scope_value)
            OR (p_scope = 'family'  AND fm.family_id::text = p_scope_value))
     GROUP BY g.receiver_id
  )
  SELECT a.uid, p.username, p.avatar, p.country, COALESCE(p.vip_level,0), a.total,
         ROW_NUMBER() OVER (ORDER BY a.total DESC) AS rnk
    FROM agg a JOIN public.profiles p ON p.id = a.uid
   ORDER BY a.total DESC
   LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.rank_gifters(text,text,text,int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rank_hosts  (text,text,text,int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vip_period_start(text)           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vip_user_family(uuid)            TO anon, authenticated;
