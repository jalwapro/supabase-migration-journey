-- Repair incomplete coin cost-basis records and make gifting resilient to legacy/admin/seller coins.
-- Standard fallback: 100 coins = PKR 1.00 (PKR 0.01 per coin).
-- Existing paid purchase cost basis remains authoritative; only missing coin quantity uses fallback.

BEGIN;

DO $patch_gift_basis$
DECLARE
  v_def text;
  v_old text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef('public.send_gift(uuid,uuid,uuid,integer,boolean)'::regprocedure);

  IF position('v_basis_cost_spent numeric' in v_def) = 0 THEN
    v_def := replace(v_def, 'v_basis_coins bigint;', 'v_basis_coins bigint; v_basis_cost_spent numeric;');
  END IF;

  v_old := $old$
 select coins_remaining,cost_pkr_remaining into v_basis_coins,v_cost_pkr from public.coin_cost_basis where user_id=v_sender for update;
 if not found or coalesce(v_basis_coins,0)<v_coins then raise exception 'Coin purchase value is not available for this balance. Please recharge coins again before gifting.'; end if;
 v_cost_pkr=round((v_cost_pkr*v_coins)/nullif(v_basis_coins,0),8);
$old$;

  v_new := $new$
 select coins_remaining,cost_pkr_remaining into v_basis_coins,v_cost_pkr from public.coin_cost_basis where user_id=v_sender for update;
 if not found then v_basis_coins:=0; v_cost_pkr:=0; end if;
 if coalesce(v_basis_coins,0)>0 then
   v_basis_cost_spent:=round((coalesce(v_cost_pkr,0)*least(v_basis_coins,v_coins)::numeric)/v_basis_coins,8);
 else
   v_basis_cost_spent:=0;
 end if;
 v_cost_pkr:=round(coalesce(v_basis_cost_spent,0)+(greatest(v_coins-coalesce(v_basis_coins,0),0)::numeric*0.01),8);
$new$;

  IF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'send_gift basis guard did not match expected live definition; no changes applied';
  END IF;
  v_def := replace(v_def, v_old, v_new);

  v_old := 'coins_remaining=coins_remaining-v_coins,cost_pkr_remaining=greatest(0,round(cost_pkr_remaining-v_cost_pkr,8))';
  v_new := 'coins_remaining=greatest(0,coins_remaining-v_coins),cost_pkr_remaining=greatest(0,round(cost_pkr_remaining-v_basis_cost_spent,8))';
  IF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'send_gift basis deduction did not match expected live definition; no changes applied';
  END IF;
  v_def := replace(v_def, v_old, v_new);
  EXECUTE v_def;
END;
$patch_gift_basis$;

DO $patch_admin_recharge$
DECLARE
  v_def text;
  v_old text := 'IF p_amount_pkr>0 THEN PERFORM public.record_coin_purchase_cost(p_user_id,p_coins,round(p_amount_pkr,2)); END IF;';
  v_new text := 'IF p_amount_pkr>0 THEN PERFORM public.record_coin_purchase_cost(p_user_id,p_coins,round(p_amount_pkr,2)); ELSE PERFORM public.record_coin_purchase_cost(p_user_id,p_coins,p_coins::numeric*0.01); END IF;';
BEGIN
  v_def := pg_get_functiondef('public.admin_manual_recharge_user(uuid,bigint,numeric,text,text,text)'::regprocedure);
  IF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'admin_manual_recharge_user cost-basis hook did not match expected live definition';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END;
$patch_admin_recharge$;

DO $patch_seller_transfer$
DECLARE
  v_def text;
  v_old text := $old$
  INSERT INTO public.wallet_transactions
    (user_id, kind, coins, coins_delta, balance_coins_after, ref_type, ref_id, note)
  VALUES
    (v_buyer.id, 'seller_transfer', p_coins, p_coins, v_buyer_balance,
     'coin_seller_transfer', v_tx_id,
     'Coins received from seller ' || coalesce(v_seller.public_name, 'JALWA seller'));

  RETURN jsonb_build_object(
$old$;
  v_new text := $new$
  INSERT INTO public.wallet_transactions
    (user_id, kind, coins, coins_delta, balance_coins_after, ref_type, ref_id, note)
  VALUES
    (v_buyer.id, 'seller_transfer', p_coins, p_coins, v_buyer_balance,
     'coin_seller_transfer', v_tx_id,
     'Coins received from seller ' || coalesce(v_seller.public_name, 'JALWA seller'));

  -- Seller transfer RPC does not carry a buyer payment amount; use the standard fallback rate.
  PERFORM public.record_coin_purchase_cost(v_buyer.id, p_coins, p_coins::numeric * 0.01);

  RETURN jsonb_build_object(
$new$;
BEGIN
  v_def := pg_get_functiondef('public.coin_seller_transfer(text,bigint)'::regprocedure);
  IF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'coin_seller_transfer cost-basis hook did not match expected live definition';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END;
$patch_seller_transfer$;

-- Fill only the difference between current wallet balance and already recorded remaining basis.
INSERT INTO public.coin_cost_basis(user_id, coins_remaining, cost_pkr_remaining, updated_at)
SELECT p.id, greatest(coalesce(p.coins,0),0), greatest(coalesce(p.coins,0),0)::numeric * 0.01, now()
FROM public.profiles p
WHERE coalesce(p.coins,0) > 0
ON CONFLICT (user_id) DO UPDATE
SET coins_remaining = public.coin_cost_basis.coins_remaining
    + greatest(EXCLUDED.coins_remaining - public.coin_cost_basis.coins_remaining, 0),
    cost_pkr_remaining = public.coin_cost_basis.cost_pkr_remaining
    + greatest(EXCLUDED.coins_remaining - public.coin_cost_basis.coins_remaining, 0)::numeric * 0.01,
    updated_at = now();

NOTIFY pgrst, 'reload schema';
COMMIT;
