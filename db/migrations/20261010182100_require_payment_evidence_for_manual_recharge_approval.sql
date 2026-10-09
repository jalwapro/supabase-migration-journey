CREATE OR REPLACE FUNCTION public.approve_recharge(_request_id uuid, _admin_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE _req public.recharge_requests%rowtype; v_txn_ref text; v_proof text; v_amount numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('admin'::public.app_role,'super_admin'::public.app_role)
  ) THEN RAISE EXCEPTION 'Admins only' USING ERRCODE='42501'; END IF;

  SELECT * INTO _req FROM public.recharge_requests WHERE id=_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _req.status<>'pending' THEN RAISE EXCEPTION 'Already %',_req.status; END IF;

  v_txn_ref:=COALESCE(NULLIF(BTRIM(_req.txn_reference),''),NULLIF(BTRIM(_req.txn_id),''),'');
  v_proof:=COALESCE(NULLIF(BTRIM(_req.proof_url),''),NULLIF(BTRIM(_req.proof_image),''),'');
  v_amount:=COALESCE(_req.amount_pkr,_req.amount_paid,0);
  IF v_amount<=0 OR v_txn_ref='' OR v_proof='' THEN
    RAISE EXCEPTION 'Payment proof, transaction reference, and positive amount are required before approval';
  END IF;

  UPDATE public.recharge_requests SET status='approved',admin_note=COALESCE(_admin_note,admin_note),reviewed_by=auth.uid(),reviewed_at=now()
  WHERE id=_request_id;
  PERFORM set_config('app.trusted_definer','on',true);
  UPDATE public.profiles SET coins=coins+_req.coins_expected,updated_at=now() WHERE id=_req.user_id;
  PERFORM public.record_coin_purchase_cost(_req.user_id,_req.coins_expected,v_amount);
  PERFORM set_config('app.trusted_definer','off',true);

  INSERT INTO public.wallet_transactions(user_id,kind,coins_delta,ref_type,ref_id,note)
  VALUES(_req.user_id,'recharge',_req.coins_expected,'recharge_request',_req.id,'Recharge approved after payment proof review');
  INSERT INTO public.notifications(user_id,kind,title,body,entity_type,entity_id)
  VALUES(_req.user_id,'recharge_approved','Recharge approved 🎉','Rs '||v_amount::text||' recharge approved. '||_req.coins_expected::text||' coins credited.','recharge_request',_req.id);
  INSERT INTO public.admin_logs(action,target,details)
  VALUES('recharge_approved',_req.id::text,jsonb_build_object('user_id',_req.user_id,'coins',_req.coins_expected,
    'amount_pkr',v_amount,'method',_req.method,'admin_note',_admin_note,'verified_proof',true));
END;
$function$;
REVOKE ALL ON FUNCTION public.approve_recharge(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_recharge(uuid,text) TO authenticated;
