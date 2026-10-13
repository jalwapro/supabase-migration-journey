-- Diamond payout requests and Super Coin Agent slip verification.
CREATE TABLE IF NOT EXISTS public.diamond_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  normal_agent_id uuid NOT NULL REFERENCES auth.users(id),
  super_agent_id uuid REFERENCES auth.users(id),
  diamonds bigint NOT NULL CHECK (diamonds > 0),
  payout_amount numeric(14,2) NOT NULL CHECK (payout_amount > 0),
  currency text NOT NULL DEFAULT 'PKR',
  payout_method text NOT NULL,
  payout_account_number text NOT NULL,
  payout_account_name text NOT NULL,
  payout_slip_url text,
  status text NOT NULL DEFAULT 'pending_agent_payment'
    CHECK (status IN ('pending_agent_payment', 'slip_submitted', 'completed', 'rejected')),
  agent_paid_at timestamptz,
  super_agent_approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS diamond_payout_requests_user_created_idx
  ON public.diamond_payout_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS diamond_payout_requests_agent_status_idx
  ON public.diamond_payout_requests (normal_agent_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS diamond_payout_requests_super_status_idx
  ON public.diamond_payout_requests (super_agent_id, status, created_at DESC);

ALTER TABLE public.diamond_payout_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.diamond_payout_requests TO authenticated;
REVOKE UPDATE ON public.diamond_payout_requests FROM authenticated;
GRANT UPDATE (payout_slip_url, status, agent_paid_at, updated_at)
  ON public.diamond_payout_requests TO authenticated;
REVOKE ALL ON public.diamond_payout_requests FROM anon;

DROP POLICY IF EXISTS diamond_payout_requests_read_participants
  ON public.diamond_payout_requests;
CREATE POLICY diamond_payout_requests_read_participants
  ON public.diamond_payout_requests FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR normal_agent_id = (SELECT auth.uid())
    OR super_agent_id = (SELECT auth.uid())
    OR public.is_admin((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS diamond_payout_requests_user_create
  ON public.diamond_payout_requests;
CREATE POLICY diamond_payout_requests_user_create
  ON public.diamond_payout_requests FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND status = 'pending_agent_payment'
    AND payout_slip_url IS NULL
    AND agent_paid_at IS NULL
    AND super_agent_approved_at IS NULL
  );

DROP POLICY IF EXISTS diamond_payout_requests_agent_submit_slip
  ON public.diamond_payout_requests;
CREATE POLICY diamond_payout_requests_agent_submit_slip
  ON public.diamond_payout_requests FOR UPDATE TO authenticated
  USING (
    normal_agent_id = (SELECT auth.uid())
    AND status = 'pending_agent_payment'
  )
  WITH CHECK (
    normal_agent_id = (SELECT auth.uid())
    AND status = 'slip_submitted'
    AND payout_slip_url IS NOT NULL
    AND agent_paid_at IS NOT NULL
  );

CREATE OR REPLACE FUNCTION public.super_agent_verify_payout_slip(
  _request_id uuid,
  _decision text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req public.diamond_payout_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF _decision NOT IN ('APPROVE', 'REJECT') THEN
    RAISE EXCEPTION 'INVALID_DECISION';
  END IF;

  SELECT * INTO v_req
  FROM public.diamond_payout_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  END IF;

  -- Only submitted slips can be decided; prevents duplicate inventory credit.
  IF v_req.status <> 'slip_submitted' THEN
    RAISE EXCEPTION 'REQUEST_NOT_AWAITING_VERIFICATION';
  END IF;

  -- Only the parent Super Agent or an app admin may verify.
  IF NOT EXISTS (
    SELECT 1
    FROM public.coin_agent_roles
    WHERE user_id = v_req.normal_agent_id
      AND role = 'coin_agent'
      AND parent_agent_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED_NOT_PARENT_SUPER_AGENT';
  END IF;

  IF _decision = 'APPROVE' THEN
    UPDATE public.diamond_payout_requests
    SET status = 'completed',
        super_agent_approved_at = now(),
        updated_at = now()
    WHERE id = _request_id;

    INSERT INTO public.coin_agent_balances
      (agent_id, source_type, available_diamonds, total_acquired_diamonds, updated_at)
    VALUES
      (v_req.normal_agent_id, 'profile_diamonds', v_req.diamonds, v_req.diamonds, now())
    ON CONFLICT (agent_id, source_type)
    DO UPDATE SET
      available_diamonds = public.coin_agent_balances.available_diamonds + EXCLUDED.available_diamonds,
      total_acquired_diamonds = public.coin_agent_balances.total_acquired_diamonds + EXCLUDED.total_acquired_diamonds,
      updated_at = now();
  ELSE
    UPDATE public.diamond_payout_requests
    SET status = 'rejected',
        updated_at = now()
    WHERE id = _request_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.super_agent_verify_payout_slip(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_agent_verify_payout_slip(uuid, text) TO authenticated;
