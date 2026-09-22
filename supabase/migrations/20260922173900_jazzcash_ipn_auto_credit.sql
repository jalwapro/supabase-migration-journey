create unique index if not exists uq_recharge_orders_gateway_order_ref
on public.recharge_orders(gateway_provider, gateway_order_ref)
where gateway_provider is not null and gateway_order_ref is not null;

create or replace function public.create_jazzcash_recharge_order(
  _package_id uuid,
  _account_ref text,
  _gateway_order_ref text
) returns public.recharge_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  _pkg public.coin_packages%rowtype;
  _order public.recharge_orders%rowtype;
begin
  if auth.uid() is null then raise exception 'Auth required'; end if;
  if coalesce(trim(_gateway_order_ref),'') = '' then raise exception 'Gateway reference required'; end if;
  if coalesce(trim(_account_ref),'') = '' then raise exception 'JazzCash account required'; end if;
  select * into _pkg from public.coin_packages where id = _package_id and active = true for share;
  if not found then raise exception 'Package not found'; end if;

  insert into public.recharge_orders(
    user_id, package_id, method, account_ref, amount_pkr, coins_total,
    otp_code, gateway_provider, gateway_order_ref, gateway_status, gateway_payload
  ) values (
    auth.uid(), _pkg.id, 'jazzcash'::public.recharge_pay_method, trim(_account_ref),
    _pkg.price_pkr, (_pkg.coins + _pkg.bonus_coins), 'GATEWAY',
    'jazzcash', trim(_gateway_order_ref), 'pending', '{}'::jsonb
  ) returning * into _order;
  return _order;
end;
$$;

revoke all on function public.create_jazzcash_recharge_order(uuid,text,text) from public, anon, authenticated;
grant execute on function public.create_jazzcash_recharge_order(uuid,text,text) to authenticated;

create or replace function public.gateway_credit_recharge_by_ref(
  _provider text, _order_ref text, _provider_txn text, _status text,
  _amount_pkr numeric, _raw jsonb default '{}'::jsonb
) returns table(success boolean, message text, new_balance bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.recharge_orders%rowtype;
  b bigint;
  v_provider text := lower(trim(coalesce(_provider,'')));
  v_order_ref text := trim(coalesce(_order_ref,''));
  v_txn text := trim(coalesce(_provider_txn,''));
  v_status text := lower(trim(coalesce(_status,'')));
begin
  if v_provider <> 'jazzcash' or v_order_ref = '' then
    return query select false, 'Invalid gateway callback'::text, 0::bigint; return;
  end if;

  select * into o from public.recharge_orders
  where gateway_provider = v_provider and gateway_order_ref = v_order_ref for update;
  if not found then
    return query select false, 'Recharge order not found'::text, 0::bigint; return;
  end if;

  if o.status = 'completed' then
    select coins into b from public.profiles where id=o.user_id;
    return query select true, 'Already credited'::text, coalesce(b,0); return;
  end if;

  if v_status <> 'success' then
    update public.recharge_orders set gateway_status=v_status, gateway_payload=coalesce(_raw,'{}'::jsonb),
      status=case when v_status in ('failed','failure','cancelled','expired') then 'failed'::public.recharge_order_status else status end
    where id=o.id;
    return query select false, ('Payment status: '||v_status)::text, 0::bigint; return;
  end if;

  if v_txn = '' then return query select false, 'Missing provider transaction reference'::text, 0::bigint; return; end if;
  if _amount_pkr is null or _amount_pkr <> o.amount_pkr then
    return query select false, 'Payment amount mismatch'::text, 0::bigint; return;
  end if;

  if exists(select 1 from public.recharge_orders x
    where x.gateway_provider=v_provider and x.gateway_transaction_ref=v_txn and x.id<>o.id) then
    return query select false, 'Provider transaction already used'::text, 0::bigint; return;
  end if;

  update public.recharge_orders set gateway_transaction_ref=v_txn, gateway_status='success',
    gateway_payload=coalesce(_raw,'{}'::jsonb) where id=o.id;

  update public.profiles set coins=coins+o.coins_total, updated_at=now()
    where id=o.user_id returning coins into b;
  if b is null then raise exception 'Profile not found'; end if;

  update public.recharge_orders set status='completed', completed_at=now() where id=o.id;

  insert into public.wallet_transactions(
    user_id, kind, coins_delta, balance_coins_after, ref_type, ref_id, note
  ) values(
    o.user_id, 'recharge', o.coins_total, b, 'jazzcash_ipn', o.id,
    'Recharge via JazzCash (verified IPN)'
  );
  return query select true, 'Payment confirmed and coins credited'::text, b;
end;
$$;

revoke all on function public.gateway_credit_recharge_by_ref(text,text,text,text,numeric,jsonb) from public, anon, authenticated;
grant execute on function public.gateway_credit_recharge_by_ref(text,text,text,text,numeric,jsonb) to service_role;

notify pgrst, 'reload schema';
