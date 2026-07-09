-- Defer diamond crediting until the room ends. During a live room, the
-- receiver only accrues raw gift "points" (coins_spent). When the host
-- ends the room, finalize_room_gifts converts those points to diamonds
-- using the internal host share and adds them to the receiver's profile.
-- This hides the conversion ratio from users during the live session —
-- they simply see the full gift value (e.g. a 100-coin gift => 100 points).

ALTER TABLE public.gift_sends
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_gift_sends_room_unfinalized
  ON public.gift_sends (room_id) WHERE finalized_at IS NULL;

-- send_gift: no longer credits diamonds or writes the receiver ledger row.
-- diamonds_earned is still recorded on gift_sends for later finalization.
CREATE OR REPLACE FUNCTION public.send_gift(
  _room_id uuid, _receiver_id uuid, _gift_id uuid, _quantity integer DEFAULT 1
) RETURNS public.gift_sends
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
declare
  g public.gifts;
  sender uuid := auth.uid();
  total_coins int;
  host_share constant numeric := 0.6;
  diamonds_earned int;
  new_sender_coins int;
  send_row public.gift_sends;
begin
  if sender is null then raise exception 'not authenticated'; end if;
  if _quantity <= 0 then raise exception 'invalid quantity'; end if;
  if _receiver_id = sender then raise exception 'cannot gift yourself'; end if;

  select * into g from public.gifts where id = _gift_id and coalesce(active, is_active);
  if not found then raise exception 'gift not found'; end if;

  total_coins := coalesce(g.price_coins, g.price) * _quantity;
  diamonds_earned := floor(total_coins * host_share) + (coalesce(g.diamonds_value,0) * _quantity);

  update public.profiles
     set coins = coins - total_coins
   where id = sender and coins >= total_coins
   returning coins into new_sender_coins;
  if not found then raise exception 'insufficient coins'; end if;

  insert into public.gift_sends
    (room_id, sender_id, receiver_id, gift_id, quantity, coins_spent, diamonds_earned)
  values
    (_room_id, sender, _receiver_id, _gift_id, _quantity, total_coins, diamonds_earned)
  returning * into send_row;

  insert into public.wallet_transactions
    (user_id, kind, coins_delta, balance_coins_after, ref_type, ref_id, note)
  values
    (sender, 'gift_sent', -total_coins, new_sender_coins, 'gift', send_row.id,
     'Sent ' || _quantity || 'x ' || g.name);

  if _room_id is not null then
    insert into public.room_messages (room_id, user_id, kind, text, message, meta)
    values (_room_id, sender, 'gift', g.name, g.name,
      jsonb_build_object(
        'giftId', g.id, 'giftName', g.name, 'icon', coalesce(g.icon, g.emoji),
        'quantity', _quantity, 'coins', total_coins,
        'receiverId', _receiver_id, 'animation', g.animation
      ));
  end if;

  return send_row;
end $function$;

GRANT EXECUTE ON FUNCTION public.send_gift(uuid, uuid, uuid, integer) TO authenticated;

-- send_room_gift: same deferral.
CREATE OR REPLACE FUNCTION public.send_room_gift(
  _room_id uuid, _emoji text, _name text, _price integer, _target text,
  _target_id uuid DEFAULT NULL, _gift_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  sender uuid := auth.uid();
  host uuid;
  new_coins bigint;
  diamonds_earned bigint;
  host_share constant numeric := 0.6;
BEGIN
  IF sender IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _price < 0 THEN RAISE EXCEPTION 'invalid price'; END IF;

  SELECT host_id INTO host FROM public.live_rooms WHERE id = _room_id;
  IF host IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;

  diamonds_earned := floor(_price * host_share);

  UPDATE public.profiles SET coins = coins - _price
   WHERE id = sender AND coins >= _price
   RETURNING coins INTO new_coins;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient coins'; END IF;

  INSERT INTO public.wallet_transactions
    (user_id, kind, coins_delta, balance_coins_after, ref_type, ref_id, note)
  VALUES
    (sender, 'gift_sent', -_price, new_coins, 'room_gift', _room_id,
     'Sent ' || _name || COALESCE(' ' || _emoji, ''));

  INSERT INTO public.room_messages (room_id, user_id, kind, text, message, meta)
  VALUES (_room_id, sender, 'gift', _name, _name,
    jsonb_build_object(
      'giftId', _gift_id, 'giftName', _name, 'icon', _emoji,
      'quantity', 1, 'coins', _price,
      'receiverId', COALESCE(_target_id, host)
    ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_room_gift(uuid, text, text, integer, text, uuid, uuid) TO authenticated, service_role;

-- finalize_room_gifts: called when the room ends. Sums diamonds_earned per
-- receiver for all unfinalized gift_sends in the room, credits the receiver's
-- profile, writes a single wallet_transactions row per receiver, and stamps
-- the rows as finalized. Idempotent — safe to call more than once.
CREATE OR REPLACE FUNCTION public.finalize_room_gifts(_room_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF _room_id IS NULL THEN RETURN; END IF;

  FOR r IN
    SELECT receiver_id, SUM(diamonds_earned)::bigint AS total_diamonds
      FROM public.gift_sends
     WHERE room_id = _room_id
       AND finalized_at IS NULL
       AND receiver_id IS NOT NULL
     GROUP BY receiver_id
  LOOP
    IF r.total_diamonds > 0 THEN
      UPDATE public.profiles
         SET diamonds = diamonds + r.total_diamonds
       WHERE id = r.receiver_id;

      INSERT INTO public.wallet_transactions
        (user_id, kind, diamonds_delta, ref_type, ref_id, note)
      VALUES
        (r.receiver_id, 'gift_received', r.total_diamonds, 'room_gift', _room_id,
         'Room gifts finalized');
    END IF;
  END LOOP;

  UPDATE public.gift_sends
     SET finalized_at = now()
   WHERE room_id = _room_id
     AND finalized_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_room_gifts(uuid) TO authenticated, service_role;
