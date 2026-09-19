-- 0260: align manual recharge RPC with the live recharge_requests.pay_method enum.
-- Also reload PostgREST so the RPC signature is immediately visible to the Data API.

DROP FUNCTION IF EXISTS public.create_manual_recharge(uuid, recharge_method, text, text, text);

CREATE OR REPLACE FUNCTION public.create_manual_recharge(
  _package_id uuid,
  _method public.pay_method,
  _sender_account text,
  _txn_reference text,
  _proof_url text
)
RETURNS public.recharge_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  p public.coin_packages;
  r public.recharge_requests;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _method NOT IN ('easypaisa'::public.pay_method, 'jazzcash'::public.pay_method) THEN
    RAISE EXCEPTION 'Manual QR only supports Easypaisa or JazzCash';
  END IF;

  IF COALESCE(length(trim(_sender_account)), 0) < 4 THEN
    RAISE EXCEPTION 'Sender account is required';
  END IF;

  IF COALESCE(length(trim(_txn_reference)), 0) < 4 THEN
    RAISE EXCEPTION 'Transaction ID is required';
  END IF;

  IF COALESCE(length(trim(_proof_url)), 0) < 8 THEN
    RAISE EXCEPTION 'Payment screenshot is required';
  END IF;

  SELECT * INTO p
  FROM public.coin_packages
  WHERE id = _package_id
    AND COALESCE(active, is_active, false) = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Package not found or inactive';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.recharge_requests x
    WHERE x.method = _method
      AND lower(trim(COALESCE(x.txn_reference, x.txn_id))) = lower(trim(_txn_reference))
      AND x.status IN ('pending'::public.recharge_status, 'approved'::public.recharge_status)
  ) THEN
    RAISE EXCEPTION 'This transaction ID has already been submitted';
  END IF;

  INSERT INTO public.recharge_requests (
    user_id, package_id, amount_paid, coins, method,
    sender_number, txn_id, proof_image, status,
    amount_pkr, coins_expected, proof_url, sender_account, txn_reference, note
  )
  VALUES (
    auth.uid(), p.id, COALESCE(p.price_pkr, p.price),
    p.coins + p.bonus_coins, _method,
    trim(_sender_account), trim(_txn_reference), trim(_proof_url),
    'pending'::public.recharge_status,
    COALESCE(p.price_pkr, p.price), p.coins + p.bonus_coins,
    trim(_proof_url), trim(_sender_account), trim(_txn_reference),
    'Manual QR payment submitted'
  )
  RETURNING * INTO r;

  RETURN r;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_manual_recharge(uuid, public.pay_method, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
