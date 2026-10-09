CREATE TABLE IF NOT EXISTS public.admin_manual_recharge_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  coins_credited bigint NOT NULL CHECK (coins_credited > 0),
  amount_pkr numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount_pkr >= 0),
  payment_method text NOT NULL DEFAULT 'admin_manual',
  payment_reference text,
  note text NOT NULL,
  balance_before bigint NOT NULL,
  balance_after bigint NOT NULL,
  credited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_manual_recharge_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_manual_recharge_audit FROM PUBLIC, anon, authenticated;
CREATE POLICY "Super admins read manual recharge audit"
ON public.admin_manual_recharge_audit FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'::public.app_role
));
GRANT SELECT ON public.admin_manual_recharge_audit TO authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS admin_manual_recharge_payment_reference_uidx
ON public.admin_manual_recharge_audit (lower(payment_method), lower(payment_reference))
WHERE payment_reference IS NOT NULL AND btrim(payment_reference) <> '';

CREATE OR REPLACE FUNCTION public.admin_manual_recharge_user(
  p_user_id uuid, p_coins bigint, p_amount_pkr numeric DEFAULT 0,
  p_payment_method text DEFAULT 'admin_manual', p_payment_reference text DEFAULT NULL, p_note text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid(); v_before bigint; v_after bigint; v_audit_id uuid;
  v_method text := lower(btrim(coalesce(p_payment_method, 'admin_manual')));
  v_reference text := nullif(left(btrim(coalesce(p_payment_reference, '')), 160), '');
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=v_actor AND role='super_admin'::public.app_role
  ) THEN RAISE EXCEPTION 'SUPER_ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_user_id) THEN RAISE EXCEPTION 'TARGET_USER_NOT_FOUND'; END IF;
  IF p_coins IS NULL OR p_coins<=0 OR p_coins>1000000000 THEN RAISE EXCEPTION 'INVALID_COIN_AMOUNT'; END IF;
  IF p_amount_pkr IS NULL OR p_amount_pkr<0 OR p_amount_pkr>100000000000 OR round(p_amount_pkr,2)<>p_amount_pkr THEN RAISE EXCEPTION 'INVALID_PKR_AMOUNT'; END IF;
  IF v_method NOT IN ('admin_manual','cash','bank_transfer','jazzcash','easypaisa','other') THEN RAISE EXCEPTION 'INVALID_PAYMENT_METHOD'; END IF;
  IF v_note IS NULL THEN RAISE EXCEPTION 'AUDIT_REASON_REQUIRED'; END IF;
  IF p_amount_pkr>0 AND v_method<>'admin_manual' AND v_reference IS NULL THEN RAISE EXCEPTION 'PAYMENT_REFERENCE_REQUIRED'; END IF;

  SELECT coins INTO v_before FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  IF v_before IS NULL THEN RAISE EXCEPTION 'TARGET_PROFILE_HAS_NO_BALANCE'; END IF;
  IF v_before<0 OR v_before>9000000000000000000-p_coins THEN RAISE EXCEPTION 'COIN_BALANCE_LIMIT'; END IF;
  v_after:=v_before+p_coins;

  INSERT INTO public.admin_manual_recharge_audit(user_id,coins_credited,amount_pkr,payment_method,payment_reference,note,balance_before,balance_after,credited_by)
  VALUES(p_user_id,p_coins,round(p_amount_pkr,2),v_method,v_reference,v_note,v_before,v_after,v_actor)
  RETURNING id INTO v_audit_id;

  PERFORM set_config('app.trusted_definer','on',true);
  UPDATE public.profiles SET coins=v_after,updated_at=now() WHERE id=p_user_id;
  PERFORM set_config('app.trusted_definer','off',true);

  INSERT INTO public.wallet_transactions(user_id,kind,coins_delta,ref_type,ref_id,note,balance_coins_after)
  VALUES(p_user_id,'admin_manual_recharge',p_coins,'admin_manual_recharge',v_audit_id,left('Manual recharge by Super Admin: '||v_note,500),v_after);

  IF p_amount_pkr>0 THEN PERFORM public.record_coin_purchase_cost(p_user_id,p_coins,round(p_amount_pkr,2)); END IF;

  INSERT INTO public.admin_logs(admin_id,action,target,details)
  VALUES(v_actor,'admin_manual_recharge',p_user_id::text,jsonb_build_object('audit_id',v_audit_id,'coins',p_coins,
    'amount_pkr',round(p_amount_pkr,2),'payment_method',v_method,'payment_reference',v_reference,
    'balance_before',v_before,'balance_after',v_after,'note',v_note));

  INSERT INTO public.notifications(user_id,kind,title,body,data)
  VALUES(p_user_id,'recharge_approved','Coins added to your wallet',p_coins::text||' coins were added by JALWA support.',
    jsonb_build_object('audit_id',v_audit_id,'coins',p_coins));

  RETURN jsonb_build_object('audit_id',v_audit_id,'user_id',p_user_id,'coins_credited',p_coins,'balance_before',v_before,'balance_after',v_after);
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_manual_recharge_user(uuid,bigint,numeric,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_manual_recharge_user(uuid,bigint,numeric,text,text,text) TO authenticated;
