CREATE OR REPLACE FUNCTION public.can_view_diamond_payout_slip(_normal_agent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.coin_agent_roles WHERE user_id=_normal_agent_id AND role='coin_agent' AND parent_agent_id=auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('admin','super_admin'))
  );
$$;
REVOKE ALL ON FUNCTION public.can_view_diamond_payout_slip(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_diamond_payout_slip(uuid) TO authenticated;
