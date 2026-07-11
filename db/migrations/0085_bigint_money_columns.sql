-- 0085 Widen money-like columns to bigint to avoid "integer out of range"
-- for premium mythic gifts (up to 100,000,000 coins) and future accumulation.
BEGIN;

-- Drop dependent views before altering column types; recreated at end.
DROP VIEW IF EXISTS public.room_popularity;

-- Profiles: coin/diamond balances
ALTER TABLE public.profiles
  ALTER COLUMN coins    TYPE bigint USING coins::bigint,
  ALTER COLUMN diamonds TYPE bigint USING diamonds::bigint;

-- Gifts catalog: prices & diamond value
ALTER TABLE public.gifts
  ALTER COLUMN price          TYPE bigint USING price::bigint,
  ALTER COLUMN price_coins    TYPE bigint USING price_coins::bigint,
  ALTER COLUMN diamonds_value TYPE bigint USING diamonds_value::bigint;

-- Gift sends ledger
ALTER TABLE public.gift_sends
  ALTER COLUMN coins_spent     TYPE bigint USING coins_spent::bigint,
  ALTER COLUMN diamonds_earned TYPE bigint USING diamonds_earned::bigint;

-- Wallet transactions ledger
ALTER TABLE public.wallet_transactions
  ALTER COLUMN coins_delta         TYPE bigint USING coins_delta::bigint,
  ALTER COLUMN diamonds_delta      TYPE bigint USING diamonds_delta::bigint,
  ALTER COLUMN balance_coins_after TYPE bigint USING balance_coins_after::bigint;

-- Recharge packages (large top-ups)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='recharge_packages' AND column_name='coins') THEN
    EXECUTE 'ALTER TABLE public.recharge_packages
             ALTER COLUMN coins       TYPE bigint USING coins::bigint,
             ALTER COLUMN bonus_coins TYPE bigint USING bonus_coins::bigint';
  END IF;
END $$;

-- Shop items (diamond/coin prices can grow)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='shop_items' AND column_name='price') THEN
    EXECUTE 'ALTER TABLE public.shop_items ALTER COLUMN price TYPE bigint USING price::bigint';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='shop_items' AND column_name='price_diamonds') THEN
    EXECUTE 'ALTER TABLE public.shop_items ALTER COLUMN price_diamonds TYPE bigint USING price_diamonds::bigint';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='shop_purchases' AND column_name='purchased_price_diamonds') THEN
    EXECUTE 'ALTER TABLE public.shop_purchases ALTER COLUMN purchased_price_diamonds TYPE bigint USING purchased_price_diamonds::bigint';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='shop_purchases' AND column_name='purchased_price') THEN
    EXECUTE 'ALTER TABLE public.shop_purchases ALTER COLUMN purchased_price TYPE bigint USING purchased_price::bigint';
  END IF;
END $$;

-- Ludo / game bets & payouts if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='ludo_games' AND column_name='bet_coins') THEN
    EXECUTE 'ALTER TABLE public.ludo_games
             ALTER COLUMN bet_coins    TYPE bigint USING bet_coins::bigint,
             ALTER COLUMN payout_coins TYPE bigint USING payout_coins::bigint';
  END IF;
END $$;

-- Rewrite gift RPCs so internal numeric vars are bigint too.
CREATE OR REPLACE FUNCTION public.send_gift(
  _room_id uuid, _gift_id uuid, _receiver_id uuid, _quantity int DEFAULT 1
) RETURNS public.gift_sends
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sender uuid := auth.uid();
  g public.gifts%ROWTYPE;
  economy jsonb;
  host_share numeric := 0.5;
  total_coins bigint;
  diamonds_earned bigint;
  new_sender_coins bigint;
  send_row public.gift_sends;
BEGIN
  IF sender IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF _quantity IS NULL OR _quantity < 1 THEN _quantity := 1; END IF;

  SELECT * INTO g FROM public.gifts WHERE id = _gift_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'gift not found'; END IF;

  total_coins := COALESCE(g.price_coins, g.price)::bigint * _quantity;

  SELECT value INTO economy FROM public.app_settings WHERE key = 'economy';
  IF economy ? 'hostGiftShare' THEN
    host_share := (economy->>'hostGiftShare')::numeric;
  END IF;

  diamonds_earned := floor(total_coins * host_share)::bigint
                     + (COALESCE(g.diamonds_value,0)::bigint * _quantity);

  UPDATE public.profiles
     SET coins = coins - total_coins
   WHERE id = sender AND coins >= total_coins
   RETURNING coins INTO new_sender_coins;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient coins'; END IF;

  UPDATE public.profiles
     SET diamonds = diamonds + diamonds_earned
   WHERE id = _receiver_id;

  INSERT INTO public.gift_sends
    (room_id, sender_id, receiver_id, gift_id, quantity, coins_spent, diamonds_earned)
  VALUES
    (_room_id, sender, _receiver_id, _gift_id, _quantity, total_coins, diamonds_earned)
  RETURNING * INTO send_row;

  INSERT INTO public.wallet_transactions
    (user_id, kind, coins_delta, balance_coins_after, ref_type, ref_id, note)
  VALUES
    (sender, 'gift_sent', -total_coins, new_sender_coins, 'gift', send_row.id,
     'Sent ' || _quantity || 'x ' || g.name);

  INSERT INTO public.wallet_transactions
    (user_id, kind, diamonds_delta, ref_type, ref_id, note)
  VALUES
    (_receiver_id, 'gift_received', diamonds_earned, 'gift', send_row.id,
     'Received ' || _quantity || 'x ' || g.name);

  RETURN send_row;
END $$;

-- Recreate dependent views
CREATE OR REPLACE VIEW public.room_popularity AS
SELECT r.id AS room_id,
       COALESCE(sum(gs.coins_spent), 0::bigint) AS coin_score,
       COALESCE(sum(gs.quantity), 0::bigint)    AS gift_count,
       (SELECT count(*) FROM public.room_seat_likes sl WHERE sl.room_id = r.id) AS like_count
  FROM public.live_rooms r
  LEFT JOIN public.gift_sends gs ON gs.room_id = r.id
 GROUP BY r.id;

GRANT SELECT ON public.room_popularity TO anon, authenticated;
GRANT ALL ON public.room_popularity TO service_role;

COMMIT;
