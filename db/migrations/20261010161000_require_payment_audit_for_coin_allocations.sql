-- Prevent un-audited positive inventory allocations through the legacy adjustment RPC.
-- All positive coin credits must use admin_verify_coin_seller_payment.
create or replace function public.admin_adjust_coin_seller_inventory(
  p_seller_id uuid,
  p_delta bigint,
  p_payment_reference text default null,
  p_note text default null
)
returns public.coin_seller_inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory public.coin_seller_inventory;
  v_new_balance bigint;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_delta is null or p_delta = 0 or p_delta < -1000000000 or p_delta > 1000000000 then
    raise exception 'Enter a valid non-zero inventory adjustment';
  end if;
  if p_delta > 0 then
    raise exception 'Positive coin allocations must use the verified payment workflow so PKR amount and payment reference are audited';
  end if;
  if nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'A reason is required for negative inventory adjustments';
  end if;
  if not exists (select 1 from public.coin_sellers where user_id = p_seller_id and is_active) then
    raise exception 'Seller does not exist or is inactive';
  end if;

  insert into public.coin_seller_inventory(seller_id, available_coins, total_allocated, total_sold)
  values (p_seller_id, 0, 0, 0)
  on conflict (seller_id) do nothing;

  select * into v_inventory from public.coin_seller_inventory
   where seller_id = p_seller_id for update;

  v_new_balance := v_inventory.available_coins + p_delta;
  if v_new_balance < 0 then
    raise exception 'Adjustment exceeds available seller inventory';
  end if;

  update public.coin_seller_inventory
     set available_coins = v_new_balance, updated_at = now()
   where seller_id = p_seller_id returning * into v_inventory;

  insert into public.coin_seller_transactions
    (seller_id, kind, coins, inventory_delta, seller_balance_after, payment_reference, note, created_by)
  values
    (p_seller_id, 'adjustment', abs(p_delta), p_delta, v_new_balance,
     nullif(left(trim(coalesce(p_payment_reference, '')), 120), ''),
     left(trim(p_note), 500), auth.uid());

  return v_inventory;
end;
$$;

revoke all on function public.admin_adjust_coin_seller_inventory(uuid, bigint, text, text) from public, anon;
grant execute on function public.admin_adjust_coin_seller_inventory(uuid, bigint, text, text) to authenticated;
