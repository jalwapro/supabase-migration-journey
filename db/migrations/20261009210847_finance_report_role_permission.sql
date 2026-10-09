CREATE OR REPLACE FUNCTION public.get_finance_report_sums()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT jsonb_build_object(
    'approved_recharge', COALESCE((SELECT SUM(amount_pkr) FROM public.recharge_requests WHERE status::text='approved'),0),
    'approved_withdrawal', COALESCE((SELECT SUM(amount_pkr) FROM public.withdrawal_requests WHERE status::text='approved'),0),
    'pending_recharge', COALESCE((SELECT SUM(amount_pkr) FROM public.recharge_requests WHERE status::text='pending'),0),
    'pending_withdrawal', COALESCE((SELECT SUM(amount_pkr) FROM public.withdrawal_requests WHERE status::text='pending'),0)
  )
  WHERE public.has_admin_permission('finance.reports');
$$;
