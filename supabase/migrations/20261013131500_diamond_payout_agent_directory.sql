CREATE OR REPLACE FUNCTION public.diamond_payout_agents_for_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'user_id', r.user_id, 'username', p.username, 'user_code', p.user_code,
      'country', cs.country, 'currency_code', ap.currency_code,
      'rate_pkr_per_1000', ap.diamond_buy_rate_pkr_per_1000
    ) ORDER BY p.username NULLS LAST)
    FROM public.coin_agent_roles r
    JOIN public.agent_profiles ap ON ap.user_id=r.user_id
    JOIN public.coin_sellers cs ON cs.user_id=r.user_id AND cs.is_active
    JOIN public.profiles p ON p.id=r.user_id
    JOIN public.coin_agent_roles sr ON sr.user_id=r.parent_agent_id AND sr.role='super_coin_agent'
    JOIN public.agent_profiles sap ON sap.user_id=sr.user_id AND sap.is_active AND sap.coin_agent_enabled AND NOT sap.is_banned
    JOIN public.coin_sellers scs ON scs.user_id=sr.user_id AND scs.is_active
    JOIN public.coin_agent_config cfg ON cfg.id=true
    WHERE r.role='coin_agent' AND ap.is_active AND ap.coin_agent_enabled AND NOT ap.is_banned
      AND ap.diamond_buy_rate_pkr_per_1000 BETWEEN cfg.min_user_buy_rate_pkr_per_1000 AND cfg.max_user_buy_rate_pkr_per_1000
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.diamond_payout_agents_for_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.diamond_payout_agents_for_user() TO authenticated;
