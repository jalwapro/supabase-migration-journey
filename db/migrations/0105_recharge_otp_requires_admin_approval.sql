-- ============================================================================
-- 0105: Recharge OTP flow must require admin approval
--
-- Problem: recharge_verify_otp was auto-crediting coins to the user's profile
-- as soon as they entered the OTP. The admin panel's "Recharge Approvals"
-- screen reads from public.recharge_requests, so admin never saw the
-- transaction and could not approve/reject it — coins were already credited.
--
-- Fix: After successful OTP match, DO NOT credit coins. Instead:
--   1. Mark the recharge_order as 'completed' (OTP verified).
--   2. Insert a matching row into public.recharge_requests with status
--      'pending' so it shows up on the admin approval screen.
--   3. Notify all admins.
--   4. Return success + message telling the user to wait for admin approval.
--
-- Coins are credited only when an admin calls approve_recharge(request_id).
-- ============================================================================

-- Ensure pay_method enum has values we need for the new UI methods
do $$ begin
  alter type public.pay_method add value if not exists 'card';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.pay_method add value if not exists 'paypal';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.pay_method add value if not exists 'bank';
exception when duplicate_object then null; end $$;

-- Add a link column so we can prevent double-submission from the same OTP order
alter table public.recharge_requests
  add column if not exists order_id uuid references public.recharge_orders(id) on delete set null;
create unique index if not exists ux_recharge_requests_order_id
  on public.recharge_requests(order_id) where order_id is not null;

create or replace function public.recharge_verify_otp(
  _order_id uuid,
  _otp text
) returns table (success boolean, coins_credited int, new_balance bigint, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  _order public.recharge_orders%rowtype;
  _req_id uuid;
  _method_text text;
  _pay_method public.pay_method;
  admin_row record;
begin
  if auth.uid() is null then raise exception 'Auth required'; end if;

  select * into _order from public.recharge_orders
    where id = _order_id and user_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;

  if _order.status <> 'pending_otp' then
    return query select false, 0, 0::bigint, 'Order already processed'::text;
    return;
  end if;

  if now() > _order.otp_expires_at then
    update public.recharge_orders set status = 'expired' where id = _order.id;
    return query select false, 0, 0::bigint, 'OTP expired'::text;
    return;
  end if;

  if _order.otp_attempts >= 5 then
    update public.recharge_orders set status = 'failed' where id = _order.id;
    return query select false, 0, 0::bigint, 'Too many attempts'::text;
    return;
  end if;

  if _order.otp_code <> _otp then
    update public.recharge_orders set otp_attempts = otp_attempts + 1 where id = _order.id;
    return query select false, 0, 0::bigint, 'Invalid OTP'::text;
    return;
  end if;

  -- OTP verified — mark order as completed but DO NOT credit yet
  update public.recharge_orders
     set status = 'completed', completed_at = now()
   where id = _order.id;

  -- Map recharge_pay_method → pay_method (enum used by recharge_requests)
  _method_text := _order.method::text;
  begin
    _pay_method := _method_text::public.pay_method;
  exception when others then
    _pay_method := 'manual'::public.pay_method;
  end;

  -- Idempotency: if we've already submitted this order for approval, reuse it
  select id into _req_id from public.recharge_requests where order_id = _order.id;
  if _req_id is null then
    insert into public.recharge_requests
      (user_id, package_id, amount_paid, coins, method, sender_account,
       txn_reference, note, status, amount_pkr, coins_expected, order_id)
    values
      (_order.user_id, _order.package_id, _order.amount_pkr, _order.coins_total,
       _pay_method, _order.account_ref,
       'OTP:' || _order.id::text,
       'Auto-OTP verified · pending admin approval',
       'pending'::public.recharge_status,
       _order.amount_pkr, _order.coins_total, _order.id)
    returning id into _req_id;

    -- Notify all admins
    for admin_row in
      select distinct ur.user_id
        from public.user_roles ur
       where ur.role in ('admin'::public.app_role, 'super_admin'::public.app_role)
    loop
      begin
        insert into public.notifications
          (user_id, kind, title, body, data, actor_id, entity_type, entity_id)
        values
          (admin_row.user_id, 'system_broadcast',
           'New recharge pending approval',
           'Rs ' || _order.amount_pkr::text || ' · ' || _order.coins_total::text || ' coins',
           jsonb_build_object('recharge_request_id', _req_id, 'order_id', _order.id),
           _order.user_id, 'recharge_request', _req_id::text);
      exception when others then null;
      end;
    end loop;
  end if;

  return query select
    true,
    0,                                    -- no coins credited yet
    coalesce((select coins from public.profiles where id = _order.user_id), 0::bigint),
    'OTP verified. Waiting for admin approval — coins will be credited once approved.'::text;
end $$;

grant execute on function public.recharge_verify_otp(uuid, text) to authenticated;

notify pgrst, 'reload schema';
