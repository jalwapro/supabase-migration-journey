ALTER TABLE public.diamond_payout_requests DROP CONSTRAINT IF EXISTS diamond_payout_requests_status_check;
ALTER TABLE public.diamond_payout_requests
  ADD CONSTRAINT diamond_payout_requests_status_check
  CHECK (status IN ('pending_agent_payment','slip_submitted','completed','rejected','cancelled'));

CREATE OR REPLACE FUNCTION public.cancel_diamond_payout_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE v_user uuid:=auth.uid(); v_req public.diamond_payout_requests%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_req FROM public.diamond_payout_requests WHERE id=_request_id FOR UPDATE;
  IF NOT FOUND OR v_req.user_id<>v_user THEN RAISE EXCEPTION 'PAYOUT_REQUEST_NOT_FOUND'; END IF;
  IF v_req.status<>'pending_agent_payment' THEN RAISE EXCEPTION 'PAYOUT_REQUEST_ALREADY_IN_PROGRESS'; END IF;
  UPDATE public.diamond_payout_requests SET status='cancelled',updated_at=now() WHERE id=_request_id;
  IF v_req.source_type='profile_diamonds' THEN
    UPDATE public.profiles SET diamonds=diamonds+v_req.diamonds,updated_at=now() WHERE id=v_user;
    INSERT INTO public.wallet_transactions(user_id,kind,diamonds,diamonds_delta,ref_type,ref_id,note)
    VALUES(v_user,'diamond_payout_refund',v_req.diamonds,v_req.diamonds,'diamond_payout_request',v_req.id,'User cancelled before agent payment; held diamonds returned');
  ELSE
    UPDATE public.host_popularity_stats SET red_diamonds=red_diamonds+v_req.diamonds,updated_at=now() WHERE host_id=v_user;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_diamond_payout_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_diamond_payout_request(uuid) TO authenticated;
