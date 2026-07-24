-- C3: Fix withdrawal flow end-to-end
-- Problems:
--  1. src/routes/_authenticated/withdraw.tsx was inserting directly into
--     withdrawal_requests, bypassing request_withdrawal — no escrow, so a user
--     could open unlimited requests without ever losing diamonds.
--  2. request_withdrawal / reject_withdrawal write to profiles.diamonds, but
--     the C1 guard trigger now reverts those writes (auth.uid() is still the
--     caller inside SECURITY DEFINER). RPCs must set the trusted marker.
--  3. approve_withdrawal didn't emit a wallet_transactions row for audit.
--  4. INSERT policy on withdrawal_requests let clients skip the RPC entirely.

-- 4: Lock down direct inserts. Requests must go through request_withdrawal.
DROP POLICY IF EXISTS "Users create own withdrawals" ON public.withdrawal_requests;

-- 2 + audit: rewrite trusted RPCs with the guard marker.
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  _diamonds bigint,
  _method pay_method,
  _account_number text,
  _account_name text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _rate numeric;
  _amount numeric;
  _id uuid;
  _new_balance bigint;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in to withdraw'; END IF;
  IF _diamonds < 100 THEN RAISE EXCEPTION 'Minimum 100 points'; END IF;
  IF _account_number IS NULL OR length(btrim(_account_number)) = 0
     OR _account_name   IS NULL OR length(btrim(_account_name))   = 0 THEN
    RAISE EXCEPTION 'Account details required';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND is_free) THEN
    RAISE EXCEPTION 'Free accounts cannot withdraw';
  END IF;

  -- Reject if the user already has a pending request (prevents queue spam).
  IF EXISTS (
    SELECT 1 FROM public.withdrawal_requests
     WHERE user_id = _uid AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending withdrawal';
  END IF;

  SELECT diamond_price_pkr INTO _rate FROM public.app_settings WHERE id = 'global';
  _amount := ROUND(_diamonds * COALESCE(_rate, 0.5), 2);

  PERFORM set_config('app.trusted_definer', 'on', true);

  UPDATE public.profiles
     SET diamonds = diamonds - _diamonds,
         updated_at = now()
   WHERE id = _uid AND diamonds >= _diamonds
   RETURNING diamonds INTO _new_balance;

  PERFORM set_config('app.trusted_definer', 'off', true);

  IF _new_balance IS NULL THEN RAISE EXCEPTION 'Not enough diamonds'; END IF;

  INSERT INTO public.withdrawal_requests
    (user_id, diamonds, amount_pkr, method, account_number, account_name)
  VALUES
    (_uid, _diamonds, _amount, _method, btrim(_account_number), btrim(_account_name))
  RETURNING id INTO _id;

  INSERT INTO public.wallet_transactions
    (user_id, kind, diamonds, diamonds_delta, ref_type, ref_id, note)
  VALUES
    (_uid, 'withdraw_hold', -_diamonds, -_diamonds, 'withdrawal', _id,
     'Withdrawal requested (held in escrow)');

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_withdrawal(bigint, pay_method, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(bigint, pay_method, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_withdrawal(_request_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _req public.withdrawal_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can reject withdrawals';
  END IF;

  SELECT * INTO _req FROM public.withdrawal_requests
    WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'Withdrawal already processed'; END IF;

  UPDATE public.withdrawal_requests
     SET status = 'rejected', processed_at = now(), admin_note = _note
   WHERE id = _request_id;

  PERFORM set_config('app.trusted_definer', 'on', true);

  UPDATE public.profiles
     SET diamonds = diamonds + _req.diamonds, updated_at = now()
   WHERE id = _req.user_id;

  PERFORM set_config('app.trusted_definer', 'off', true);

  INSERT INTO public.wallet_transactions
    (user_id, kind, diamonds, diamonds_delta, ref_type, ref_id, note)
  VALUES
    (_req.user_id, 'withdraw_refund', _req.diamonds, _req.diamonds,
     'withdrawal', _request_id,
     'Withdrawal rejected — refunded' || COALESCE(' (' || _note || ')', ''));
END;
$$;

REVOKE ALL ON FUNCTION public.reject_withdrawal(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_withdrawal(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _req public.withdrawal_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can approve withdrawals';
  END IF;

  SELECT * INTO _req FROM public.withdrawal_requests
    WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'Withdrawal already processed'; END IF;

  UPDATE public.withdrawal_requests
     SET status = 'approved', processed_at = now()
   WHERE id = _request_id;

  INSERT INTO public.wallet_transactions
    (user_id, kind, diamonds, diamonds_delta, ref_type, ref_id, note)
  VALUES
    (_req.user_id, 'withdraw_paid', 0, 0, 'withdrawal', _request_id,
     'Withdrawal approved — PKR ' || _req.amount_pkr::text || ' via ' || _req.method::text);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_withdrawal(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid) TO authenticated;
