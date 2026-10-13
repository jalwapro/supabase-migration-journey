-- Restrict normal-agent updates to the slip submission fields only.
REVOKE UPDATE ON public.diamond_payout_requests FROM authenticated;
GRANT UPDATE (payout_slip_url, status, agent_paid_at, updated_at)
  ON public.diamond_payout_requests TO authenticated;
