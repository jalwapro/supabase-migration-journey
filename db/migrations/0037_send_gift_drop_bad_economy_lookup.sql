-- Repair: send_gift + send_room_gift reference app_settings.key/value which
-- do not exist (app_settings is a singleton table with typed columns).
-- That surfaces to the client as: column "value" does not exist.
-- Drop the lookup and use a constant host share (0.6). If a future dynamic
-- share is needed, add a dedicated column to app_settings and read that.

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

  update public.profiles
     set diamonds = diamonds + diamonds_earned
   where id = _receiver_id;

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

  insert into public.wallet_transactions
    (user_id, kind, diamonds_delta, ref_type, ref_id, note)
  values
    (_receiver_id, 'gift_received', diamonds_earned, 'gift', send_row.id,
     'Received ' || _quantity || 'x ' || g.name);

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

-- Same fix for send_room_gift
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

  UPDATE public.profiles SET diamonds = diamonds + diamonds_earned
   WHERE id = COALESCE(_target_id, host);

  INSERT INTO public.wallet_transactions
    (user_id, kind, coins_delta, balance_coins_after, ref_type, ref_id, note)
  VALUES
    (sender, 'gift_sent', -_price, new_coins, 'room_gift', _room_id,
     'Sent ' || _name || COALESCE(' ' || _emoji, ''));

  INSERT INTO public.wallet_transactions
    (user_id, kind, diamonds_delta, ref_type, ref_id, note)
  VALUES
    (COALESCE(_target_id, host), 'gift_received', diamonds_earned, 'room_gift', _room_id,
     'Received ' || _name || COALESCE(' ' || _emoji, ''));

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
