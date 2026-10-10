-- Fix seller transfers being recorded in history while the profile balance guard
-- silently reverts the actual wallet credit. Reconcile only transfers with no later
-- wallet activity where both the ledger and seller transaction show the same failed
-- post-transfer balance.

CREATE OR REPLACE FUNCTION public.coin_seller_transfer(p_buyer_code text, p_coins bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller public.coin_sellers;
  v_inventory public.coin_seller_inventory;
  v_buyer public.profiles;
  v_seller_balance bigint;
  v_buyer_balance bigint;
  v_tx_id uuid;
  v_lookup text := trim(coalesce(p_buyer_code, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to transfer coins' USING errcode = '42501';
  END IF;
  IF p_coins IS NULL OR p_coins <= 0 OR p_coins > 1000000 THEN
    RAISE EXCEPTION 'Enter a coin amount between 1 and 1,000,000';
  END IF;
  IF v_lookup = '' THEN
    RAISE EXCEPTION 'Buyer JALWA ID is required';
  END IF;

  SELECT * INTO v_seller FROM public.coin_sellers
   WHERE user_id = auth.uid() AND is_active FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Your Coin Seller account is not active';
  END IF;

  INSERT INTO public.coin_seller_inventory(seller_id) VALUES (auth.uid())
  ON CONFLICT (seller_id) DO NOTHING;
  SELECT * INTO v_inventory FROM public.coin_seller_inventory
   WHERE seller_id = auth.uid() FOR UPDATE;

  IF v_inventory.available_coins < p_coins THEN
    RAISE EXCEPTION 'Insufficient seller coin inventory';
  END IF;

  SELECT * INTO v_buyer FROM public.profiles
   WHERE user_code = v_lookup OR lower(username) = lower(v_lookup)
   ORDER BY CASE WHEN user_code = v_lookup THEN 0 ELSE 1 END
   LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR v_buyer.status <> 'active' THEN
    RAISE EXCEPTION 'Buyer JALWA ID was not found or account is inactive';
  END IF;
  IF v_buyer.id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot transfer seller coins to yourself';
  END IF;
  IF coalesce(v_buyer.coins, 0) < 0 OR coalesce(v_buyer.coins, 0) > 9000000000000000000 - p_coins THEN
    RAISE EXCEPTION 'Buyer wallet would exceed supported limit';
  END IF;

  -- Required by profiles_guard_protected_columns: trusted server-side wallet write.
  PERFORM set_config('app.trusted_definer', 'on', true);
  UPDATE public.profiles SET coins = coalesce(coins, 0) + p_coins, updated_at = now()
   WHERE id = v_buyer.id RETURNING coins INTO v_buyer_balance;
  PERFORM set_config('app.trusted_definer', 'off', true);

  IF v_buyer_balance IS NULL OR v_buyer_balance < p_coins THEN
    RAISE EXCEPTION 'Buyer wallet credit failed';
  END IF;

  UPDATE public.coin_seller_inventory
   SET available_coins = available_coins - p_coins,
       total_sold = total_sold + p_coins,
       updated_at = now()
   WHERE seller_id = auth.uid()
   RETURNING available_coins INTO v_seller_balance;

  INSERT INTO public.coin_seller_transactions
    (seller_id, buyer_id, kind, coins, inventory_delta, seller_balance_after, buyer_balance_after, note, created_by)
  VALUES
    (auth.uid(), v_buyer.id, 'sale', p_coins, -p_coins, v_seller_balance,
     v_buyer_balance, 'Coin seller transfer', auth.uid())
  RETURNING id INTO v_tx_id;

  INSERT INTO public.wallet_transactions
    (user_id, kind, coins, coins_delta, balance_coins_after, ref_type, ref_id, note)
  VALUES
    (v_buyer.id, 'seller_transfer', p_coins, p_coins, v_buyer_balance,
     'coin_seller_transfer', v_tx_id,
     'Coins received from seller ' || coalesce(v_seller.public_name, 'JALWA seller'));

  RETURN jsonb_build_object(
    'transaction_id', v_tx_id,
    'buyer_id', v_buyer.id,
    'buyer_username', v_buyer.username,
    'buyer_code', v_buyer.user_code,
    'coins_transferred', p_coins,
    'buyer_balance_after', v_buyer_balance,
    'seller_balance_after', v_seller_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.coin_seller_transfer(text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coin_seller_transfer(text, bigint) TO authenticated;

-- Repair any previously failed seller credits only when the buyer has had no
-- subsequent wallet transaction and all recorded post-transfer balances still match.
DO $$
DECLARE
  v_tx record;
  v_new_balance bigint;
BEGIN
  FOR v_tx IN
    SELECT wt.id AS ledger_id, wt.user_id, wt.coins_delta, wt.ref_id,
           wt.balance_coins_after
      FROM public.wallet_transactions wt
      JOIN public.profiles p ON p.id = wt.user_id
      JOIN public.coin_seller_transactions st
        ON st.id = wt.ref_id
       AND st.buyer_id = wt.user_id
       AND st.buyer_balance_after = wt.balance_coins_after
     WHERE wt.kind = 'seller_transfer'
       AND wt.coins_delta > 0
       AND p.coins = wt.balance_coins_after
       AND NOT EXISTS (
         SELECT 1 FROM public.wallet_transactions later
          WHERE later.user_id = wt.user_id
            AND (later.created_at, later.id) > (wt.created_at, wt.id)
       )
     ORDER BY wt.created_at, wt.id
     FOR UPDATE OF wt, p, st
  LOOP
    PERFORM set_config('app.trusted_definer', 'on', true);
    UPDATE public.profiles
       SET coins = coalesce(coins, 0) + v_tx.coins_delta, updated_at = now()
     WHERE id = v_tx.user_id
     RETURNING coins INTO v_new_balance;
    PERFORM set_config('app.trusted_definer', 'off', true);

    UPDATE public.wallet_transactions
       SET balance_coins_after = v_new_balance
     WHERE id = v_tx.ledger_id;

    UPDATE public.coin_seller_transactions
       SET buyer_balance_after = v_new_balance
     WHERE id = v_tx.ref_id;
  END LOOP;
END;
$$;
