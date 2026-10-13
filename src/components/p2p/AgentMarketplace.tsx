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

-- Super Agent verify function
CREATE OR REPLACE FUNCTION public.super_agent_verify_payout_slip(
  _request_id uuid,
  _decision text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req record;
BEGIN
  SELECT * INTO v_req FROM public.diamond_payout_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
  
  -- Verify caller is the Super Agent for this Normal Agent
  IF NOT EXISTS (
    SELECT 1 FROM public.coin_agent_roles 
    WHERE user_id = v_req.normal_agent_id AND parent_agent_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED_NOT_PARENT_SUPER_AGENT';
  END IF;

  IF _decision = 'APPROVE' THEN
    UPDATE public.diamond_payout_requests 
    SET status = 'completed', super_agent_approved_at = now(), updated_at = now()
    WHERE id = _request_id;

    -- Credit diamonds into Normal Agent inventory
    INSERT INTO public.coin_agent_balances (agent_id, source_type, available_diamonds, total_acquired_diamonds)
    VALUES (v_req.normal_agent_id, 'profile_diamonds', v_req.diamonds, v_req.diamonds)
    ON CONFLICT (agent_id, source_type)
    DO UPDATE SET 
      available_diamonds = coin_agent_balances.available_diamonds + EXCLUDED.available_diamonds,
      total_acquired_diamonds = coin_agent_balances.total_acquired_diamonds + EXCLUDED.total_acquired_diamonds,
      updated_at = now();
  ELSE
    UPDATE public.diamond_payout_requests 
    SET status = 'rejected', updated_at = now() 
    WHERE id = _request_id;
  END IF;
END;
$$;
