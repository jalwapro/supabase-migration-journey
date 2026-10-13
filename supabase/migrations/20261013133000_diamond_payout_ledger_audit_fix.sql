ALTER TABLE public.coin_agent_ledger
  ADD COLUMN IF NOT EXISTS payout_request_id uuid REFERENCES public.diamond_payout_requests(id);
ALTER TABLE public.coin_agent_ledger DROP CONSTRAINT IF EXISTS coin_agent_ledger_check;
ALTER TABLE public.coin_agent_ledger
  ADD CONSTRAINT coin_agent_ledger_check
  CHECK (trade_id IS NOT NULL OR settlement_id IS NOT NULL OR payout_request_id IS NOT NULL OR entry_type='admin_adjustment');
ALTER TABLE public.coin_agent_ledger DROP CONSTRAINT IF EXISTS coin_agent_ledger_entry_type_check;
ALTER TABLE public.coin_agent_ledger
  ADD CONSTRAINT coin_agent_ledger_entry_type_check
  CHECK (entry_type IN ('trade_acquired','settlement_reserved','settlement_approved','settlement_rejected','trade_refund','admin_adjustment','payout_acquired'));
CREATE UNIQUE INDEX IF NOT EXISTS coin_agent_ledger_payout_request_uidx
  ON public.coin_agent_ledger(payout_request_id) WHERE payout_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.super_agent_verify_payout_slip(_request_id uuid,_decision text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_req public.diamond_payout_requests%ROWTYPE; v_balance bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _decision NOT IN ('APPROVE','REJECT') THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;
  SELECT * INTO v_req FROM public.diamond_payout_requests WHERE id=_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
  IF v_req.status<>'slip_submitted' THEN RAISE EXCEPTION 'REQUEST_NOT_AWAITING_VERIFICATION'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.coin_agent_roles WHERE user_id=v_req.normal_agent_id AND role='coin_agent' AND parent_agent_id=auth.uid())
     AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('admin','super_admin')) THEN
    RAISE EXCEPTION 'UNAUTHORIZED_NOT_PARENT_SUPER_AGENT';
  END IF;
  IF _decision='APPROVE' THEN
    UPDATE public.diamond_payout_requests SET status='completed',super_agent_approved_at=now(),updated_at=now() WHERE id=_request_id;
    INSERT INTO public.coin_agent_balances(agent_id,source_type,available_diamonds,total_acquired_diamonds,updated_at)
    VALUES(v_req.normal_agent_id,v_req.source_type,v_req.diamonds,v_req.diamonds,now())
    ON CONFLICT(agent_id,source_type) DO UPDATE SET
      available_diamonds=public.coin_agent_balances.available_diamonds+EXCLUDED.available_diamonds,
      total_acquired_diamonds=public.coin_agent_balances.total_acquired_diamonds+EXCLUDED.total_acquired_diamonds,updated_at=now()
    RETURNING available_diamonds INTO v_balance;
    INSERT INTO public.coin_agent_ledger(payout_request_id,agent_id,source_type,entry_type,diamond_delta,balance_after,note)
    VALUES(v_req.id,v_req.normal_agent_id,v_req.source_type,'payout_acquired',v_req.diamonds,v_balance,
      'Super Agent verified diamond payout request '||v_req.id::text);
  ELSE
    UPDATE public.diamond_payout_requests SET status='rejected',updated_at=now() WHERE id=_request_id;
    IF v_req.source_type='profile_diamonds' THEN
      UPDATE public.profiles SET diamonds=diamonds+v_req.diamonds,updated_at=now() WHERE id=v_req.user_id;
      INSERT INTO public.wallet_transactions(user_id,kind,diamonds,diamonds_delta,ref_type,ref_id,note)
      VALUES(v_req.user_id,'diamond_payout_refund',v_req.diamonds,v_req.diamonds,'diamond_payout_request',v_req.id,'Diamond payout rejected; held diamonds returned');
    ELSE
      UPDATE public.host_popularity_stats SET red_diamonds=red_diamonds+v_req.diamonds,updated_at=now() WHERE host_id=v_req.user_id;
    END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.super_agent_verify_payout_slip(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_agent_verify_payout_slip(uuid,text) TO authenticated;
