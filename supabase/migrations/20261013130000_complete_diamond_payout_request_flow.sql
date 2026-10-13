-- Complete secure diamond payout request -> agent payment slip -> Super Agent verification.
ALTER TABLE public.diamond_payout_requests
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'profile_diamonds';
ALTER TABLE public.diamond_payout_requests
  DROP CONSTRAINT IF EXISTS diamond_payout_requests_source_type_check;
ALTER TABLE public.diamond_payout_requests
  ADD CONSTRAINT diamond_payout_requests_source_type_check
  CHECK (source_type IN ('profile_diamonds','red_diamonds'));

REVOKE INSERT ON public.diamond_payout_requests FROM authenticated;
DROP POLICY IF EXISTS diamond_payout_requests_user_create ON public.diamond_payout_requests;

CREATE OR REPLACE FUNCTION public.create_diamond_payout_request(
  _agent_id uuid, _source_type text, _diamonds bigint, _payout_method text,
  _payout_account_number text, _payout_account_name text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid(); v_parent uuid; v_rate numeric; v_amount numeric;
  v_currency text; v_cfg public.coin_agent_config%ROWTYPE; v_req uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _agent_id IS NULL OR _agent_id = v_user THEN RAISE EXCEPTION 'INVALID_AGENT'; END IF;
  IF _source_type NOT IN ('profile_diamonds','red_diamonds') THEN RAISE EXCEPTION 'INVALID_DIAMOND_SOURCE'; END IF;
  IF _diamonds IS NULL OR _diamonds < 100 OR _diamonds > 1000000000 THEN RAISE EXCEPTION 'INVALID_DIAMOND_AMOUNT'; END IF;
  IF _payout_method NOT IN ('jazzcash','easypaisa','bank','other') THEN RAISE EXCEPTION 'INVALID_PAYOUT_METHOD'; END IF;
  IF length(trim(coalesce(_payout_account_name,''))) < 2 OR length(trim(coalesce(_payout_account_number,''))) < 5 THEN RAISE EXCEPTION 'PAYOUT_DETAILS_REQUIRED'; END IF;
  PERFORM 1 FROM public.profiles WHERE id = v_user FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.diamond_payout_requests WHERE user_id=v_user AND status IN ('pending_agent_payment','slip_submitted')) THEN
    RAISE EXCEPTION 'PAYOUT_REQUEST_ALREADY_PENDING';
  END IF;
  SELECT * INTO v_cfg FROM public.coin_agent_config WHERE id=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'COIN_AGENT_CONFIG_MISSING'; END IF;
  SELECT r.parent_agent_id, ap.diamond_buy_rate_pkr_per_1000, ap.currency_code
    INTO v_parent, v_rate, v_currency
  FROM public.coin_agent_roles r
  JOIN public.agent_profiles ap ON ap.user_id=r.user_id
  JOIN public.coin_sellers cs ON cs.user_id=r.user_id AND cs.is_active
  JOIN public.coin_agent_roles sr ON sr.user_id=r.parent_agent_id AND sr.role='super_coin_agent'
  JOIN public.agent_profiles sap ON sap.user_id=sr.user_id AND sap.is_active AND sap.coin_agent_enabled AND NOT sap.is_banned
  WHERE r.user_id=_agent_id AND r.role='coin_agent' AND ap.is_active AND ap.coin_agent_enabled AND NOT ap.is_banned
    AND ap.diamond_buy_rate_pkr_per_1000 BETWEEN v_cfg.min_user_buy_rate_pkr_per_1000 AND v_cfg.max_user_buy_rate_pkr_per_1000
  FOR UPDATE OF ap;
  IF NOT FOUND OR v_parent IS NULL THEN RAISE EXCEPTION 'AGENT_OR_PARENT_SUPER_AGENT_NOT_AVAILABLE'; END IF;
  v_amount := round(_diamonds::numeric * v_rate / 1000,2);
  IF _source_type='profile_diamonds' THEN
    UPDATE public.profiles SET diamonds=diamonds-_diamonds,updated_at=now() WHERE id=v_user AND diamonds>=_diamonds;
    IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_DIAMONDS'; END IF;
  ELSE
    UPDATE public.host_popularity_stats SET red_diamonds=red_diamonds-_diamonds,updated_at=now() WHERE host_id=v_user AND red_diamonds>=_diamonds;
    IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_RED_DIAMONDS'; END IF;
  END IF;
  INSERT INTO public.diamond_payout_requests(user_id,normal_agent_id,super_agent_id,source_type,diamonds,payout_amount,currency,payout_method,payout_account_number,payout_account_name)
  VALUES(v_user,_agent_id,v_parent,_source_type,_diamonds,v_amount,coalesce(nullif(v_currency,''),'PKR'),_payout_method,trim(_payout_account_number),trim(_payout_account_name))
  RETURNING id INTO v_req;
  IF _source_type='profile_diamonds' THEN
    INSERT INTO public.wallet_transactions(user_id,kind,diamonds,diamonds_delta,ref_type,ref_id,note)
    VALUES(v_user,'diamond_payout_hold',-_diamonds,-_diamonds,'diamond_payout_request',v_req,'Diamonds held for agent payout pending verification');
  END IF;
  RETURN v_req;
END;
$$;
REVOKE ALL ON FUNCTION public.create_diamond_payout_request(uuid,text,bigint,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_diamond_payout_request(uuid,text,bigint,text,text,text) TO authenticated;

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
    INSERT INTO public.coin_agent_ledger(agent_id,source_type,entry_type,diamond_delta,balance_after,note)
    VALUES(v_req.normal_agent_id,v_req.source_type,'trade_acquired',v_req.diamonds,v_balance,'Super Agent verified diamond payout request '||v_req.id::text);
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
