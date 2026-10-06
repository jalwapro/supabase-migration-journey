CREATE OR REPLACE FUNCTION public.get_finance_report_sums(p_status TEXT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'recharge', COALESCE((SELECT SUM(amount_pkr) FROM public.recharge_requests WHERE status::text = p_status), 0),
    'withdrawal', COALESCE((SELECT SUM(amount_pkr) FROM public.withdrawal_requests WHERE status::text = p_status), 0)
  )
  WHERE public.room_layout_admin();
$$;

REVOKE ALL ON FUNCTION public.get_finance_report_sums(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_finance_report_sums(TEXT) TO authenticated;
