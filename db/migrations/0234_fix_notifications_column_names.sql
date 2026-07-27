CREATE OR REPLACE FUNCTION public._notify_withdrawal_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status is distinct from old.status
     and new.status in ('approved', 'rejected') then
    insert into public.notifications (user_id, kind, title, body, entity_type, entity_id)
    values (
      new.user_id,
      case when new.status = 'approved' then 'withdrawal_approved' else 'withdrawal_rejected' end,
      case when new.status = 'approved'
             then 'Withdrawal approved 💸'
             else 'Withdrawal rejected'
      end,
      case when new.status = 'approved'
             then 'PKR ' || new.amount_pkr::text || ' payout approved to ' ||
                  coalesce(new.method, 'your account') || '.'
             else coalesce(new.admin_note,
                    'Your withdrawal was rejected. Diamonds have been refunded.')
      end,
      'withdrawal_request',
      new.id
    );
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.approve_recharge(_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _req public.recharge_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can approve recharges';
  END IF;

  SELECT * INTO _req FROM public.recharge_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recharge request not found';
  END IF;
  IF _req.status <> 'pending' THEN
    RAISE EXCEPTION 'Recharge request already processed';
  END IF;

  UPDATE public.recharge_requests
    SET status = 'approved', processed_at = now()
    WHERE id = _request_id;

  UPDATE public.profiles
    SET coins = coins + _req.coins, updated_at = now()
    WHERE id = _req.user_id;

  INSERT INTO public.wallet_transactions (user_id, kind, coins, note)
    VALUES (_req.user_id, 'recharge', _req.coins, 'Recharge approved');
END;
$function$
;
CREATE OR REPLACE FUNCTION public.approve_recharge(_request_id uuid, _admin_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _req public.recharge_requests%rowtype;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Admins only';
  end if;

  select * into _req from public.recharge_requests where id = _request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if _req.status <> 'pending' then raise exception 'Already %', _req.status; end if;

  -- Mark the request approved first.
  update public.recharge_requests
     set status = 'approved',
         admin_note = coalesce(_admin_note, admin_note),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = _request_id;

  -- Credit coins under the trusted-definer marker so the 0156 profile
  -- guard trigger allows the write.
  perform set_config('app.trusted_definer', 'on', true);
  update public.profiles
     set coins = coins + _req.coins_expected
   where id = _req.user_id;
  perform set_config('app.trusted_definer', 'off', true);

  -- Wallet ledger row.
  insert into public.wallet_transactions (
    user_id, kind, coins_delta, ref_type, ref_id, note
  ) values (
    _req.user_id, 'recharge', _req.coins_expected, 'recharge_request', _req.id,
    'Recharge approved by admin'
  );

  -- Notify the user.
  insert into public.notifications (user_id, kind, title, body, entity_type, entity_id)
  values (
    _req.user_id,
    'recharge_approved',
    'Recharge approved 🎉',
    'Rs ' || _req.amount_pkr::text || ' recharge approved. ' ||
      _req.coins_expected::text || ' coins credited.',
    'recharge_request',
    _req.id
  );

  -- Admin audit trail.
  insert into public.admin_logs (action, target, details)
  values (
    'recharge_approved',
    _req.id::text,
    jsonb_build_object(
      'user_id', _req.user_id,
      'coins', _req.coins_expected,
      'amount_pkr', _req.amount_pkr,
      'method', _req.method,
      'admin_note', _admin_note
    )
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.reject_recharge(_request_id uuid, _admin_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _req public.recharge_requests%rowtype;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Admins only';
  end if;

  select * into _req from public.recharge_requests where id = _request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if _req.status <> 'pending' then raise exception 'Already %', _req.status; end if;

  update public.recharge_requests
     set status = 'rejected',
         admin_note = coalesce(_admin_note, admin_note),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = _request_id;

  insert into public.notifications (user_id, kind, title, body, entity_type, entity_id)
  values (
    _req.user_id,
    'recharge_rejected',
    'Recharge rejected',
    coalesce(_admin_note, 'Your recharge request was rejected. Please contact support.'),
    'recharge_request',
    _req.id
  );

  insert into public.admin_logs (action, target, details)
  values (
    'recharge_rejected',
    _req.id::text,
    jsonb_build_object(
      'user_id', _req.user_id,
      'coins', _req.coins_expected,
      'amount_pkr', _req.amount_pkr,
      'admin_note', _admin_note
    )
  );
end;
$function$
;
