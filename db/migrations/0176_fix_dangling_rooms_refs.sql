CREATE OR REPLACE FUNCTION public.guard_room_participant_insert_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _host uuid;
BEGIN
  SELECT host_id INTO _host FROM public.live_rooms WHERE id = NEW.room_id;

  IF NEW.user_id = _host THEN
    NEW.seat_status := 'speaker';
  ELSE
    NEW.seat_status := 'viewer';
    NEW.is_moderator := false;
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.guard_room_participant_protected_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _host uuid;
  _actor_is_mod boolean := false;
BEGIN
  IF current_user IN ('postgres', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Sign in first';
  END IF;

  SELECT host_id INTO _host FROM public.live_rooms WHERE id = NEW.room_id;
  SELECT COALESCE(is_moderator, false) INTO _actor_is_mod
    FROM public.room_participants
    WHERE room_id = NEW.room_id AND user_id = _actor;

  IF _actor = _host OR COALESCE(_actor_is_mod, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id <> _actor THEN
    RAISE EXCEPTION 'You can only update your own room presence';
  END IF;

  IF NEW.is_moderator IS DISTINCT FROM OLD.is_moderator
     OR NEW.points IS DISTINCT FROM OLD.points
     OR NEW.seat_status IS DISTINCT FROM OLD.seat_status THEN
    RAISE EXCEPTION 'Only the host or a moderator can change stage permissions';
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.leaderboard(_kind text, _period text)
 RETURNS TABLE(user_id uuid, username text, avatar text, points bigint, is_vip boolean, level integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH span AS (
    SELECT CASE _period
      WHEN 'weekly' THEN now() - interval '7 days'
      WHEN 'monthly' THEN now() - interval '30 days'
      ELSE '-infinity'::timestamptz
    END AS since
  ),
  agg AS (
    SELECT
      CASE WHEN _kind = 'gifters' THEN ge.sender_id ELSE r.host_id END AS uid,
      SUM(ge.coins)::bigint AS pts
    FROM public.gift_events ge
    LEFT JOIN public.live_rooms r ON r.id = ge.room_id
    CROSS JOIN span
    WHERE ge.created_at >= span.since
    GROUP BY 1
  )
  SELECT a.uid, p.username, p.avatar, a.pts, p.is_vip, p.level
  FROM agg a
  JOIN public.profiles p ON p.id = a.uid
  WHERE a.uid IS NOT NULL AND a.pts > 0
  ORDER BY a.pts DESC
  LIMIT 30;
$function$
;
CREATE OR REPLACE FUNCTION public.room_end(_room_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _host uuid;
BEGIN
  SELECT host_id INTO _host FROM public.live_rooms WHERE id = _room_id;
  IF _host IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF auth.uid() <> _host THEN RAISE EXCEPTION 'Only the host can end the room'; END IF;

  UPDATE public.live_rooms
    SET is_live = false, ended_at = now(), viewers = 0
    WHERE id = _room_id;

  -- Terminate the session for everyone in the room.
  DELETE FROM public.room_participants WHERE room_id = _room_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.room_kick_user(_room_id uuid, _user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _host uuid; _is_mod boolean;
BEGIN
  SELECT host_id INTO _host FROM public.live_rooms WHERE id = _room_id;
  IF _host IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;
  SELECT is_moderator INTO _is_mod FROM public.room_participants
    WHERE room_id = _room_id AND user_id = auth.uid();
  IF auth.uid() <> _host AND COALESCE(_is_mod, false) = false THEN
    RAISE EXCEPTION 'Only the host or a moderator can remove users';
  END IF;
  IF _user_id = _host THEN RAISE EXCEPTION 'The host cannot be removed'; END IF;
  DELETE FROM public.room_participants WHERE room_id = _room_id AND user_id = _user_id;
  INSERT INTO public.room_bans (room_id, user_id)
    VALUES (_room_id, _user_id) ON CONFLICT DO NOTHING;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.room_leave_seat(_room_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _host uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT host_id INTO _host FROM public.live_rooms WHERE id = _room_id;
  IF _uid = _host THEN RAISE EXCEPTION 'The host stays on stage'; END IF;
  UPDATE public.room_participants
    SET seat_status = 'viewer', updated_at = now()
    WHERE room_id = _room_id AND user_id = _uid;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.room_manage_seat(_room_id uuid, _user_id uuid, _status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _host uuid; _is_mod boolean;
BEGIN
  IF _status NOT IN ('viewer', 'speaker') THEN
    RAISE EXCEPTION 'Invalid seat status';
  END IF;
  SELECT host_id INTO _host FROM public.live_rooms WHERE id = _room_id;
  IF _host IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;
  SELECT is_moderator INTO _is_mod FROM public.room_participants
    WHERE room_id = _room_id AND user_id = auth.uid();
  IF auth.uid() <> _host AND COALESCE(_is_mod, false) = false THEN
    RAISE EXCEPTION 'Only the host or a moderator can manage the stage';
  END IF;
  IF _user_id = _host THEN RAISE EXCEPTION 'The host is always on stage'; END IF;
  UPDATE public.room_participants
    SET seat_status = _status, updated_at = now()
    WHERE room_id = _room_id AND user_id = _user_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.room_set_moderator(_room_id uuid, _user_id uuid, _value boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _host uuid;
BEGIN
  SELECT host_id INTO _host FROM public.live_rooms WHERE id = _room_id;
  IF _host IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF auth.uid() <> _host THEN RAISE EXCEPTION 'Only the host can assign moderators'; END IF;
  UPDATE public.room_participants
    SET is_moderator = _value, updated_at = now()
    WHERE room_id = _room_id AND user_id = _user_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.send_gift(_room_id uuid, _gift_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _gift public.gifts%ROWTYPE;
  _sender_name TEXT;
  _host UUID;
  _host_share bigint;
  _admin_share bigint;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in to send gifts'; END IF;
  SELECT * INTO _gift FROM public.gifts WHERE id = _gift_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gift not found'; END IF;
  SELECT host_id INTO _host FROM public.live_rooms WHERE id = _room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;

  UPDATE public.profiles SET coins = coins - _gift.price, updated_at = now()
    WHERE id = _uid AND coins >= _gift.price RETURNING username INTO _sender_name;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not enough coins'; END IF;

  _host_share := floor(_gift.price * 0.6);
  _admin_share := _gift.price - _host_share;
  UPDATE public.profiles SET diamonds = diamonds + _host_share, updated_at = now() WHERE id = _host;
  UPDATE public.app_settings SET platform_diamonds = platform_diamonds + _admin_share WHERE id = 'global';

  UPDATE public.live_rooms SET total_points = total_points + _gift.price WHERE id = _room_id;

  INSERT INTO public.wallet_transactions (user_id, kind, coins, note)
    VALUES (_uid, 'gift', -_gift.price, 'Sent ' || _gift.name);
  INSERT INTO public.wallet_transactions (user_id, kind, diamonds, note)
    VALUES (_host, 'gift_earning', _host_share, 'Received ' || _gift.name);
  INSERT INTO public.gift_events (room_id, sender_id, sender_name, gift_id, gift_emoji, gift_name, coins)
    VALUES (_room_id, _uid, COALESCE(_sender_name, 'Guest'), _gift.id, _gift.emoji, _gift.name, _gift.price);
  INSERT INTO public.room_messages (room_id, user_id, username, message, kind)
    VALUES (_room_id, _uid, COALESCE(_sender_name, 'Guest'), 'sent a ' || _gift.emoji || ' ' || _gift.name || '!', 'gift');
END;
$function$
;
CREATE OR REPLACE FUNCTION public.send_gift(_room_id uuid, _receiver_id uuid, _gift_id uuid, _quantity integer DEFAULT 1)
 RETURNS gift_sends
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  sender uuid := auth.uid();
  g public.gifts%rowtype;
  host_share numeric;
  total_coins bigint;
  diamonds_earned bigint;
  new_sender_coins bigint;
  send_row public.gift_sends;
  recent_sends int;
begin
  if sender is null then raise exception 'not signed in'; end if;
  if _quantity is null or _quantity < 1 then _quantity := 1; end if;
  if _receiver_id = sender then raise exception 'cannot gift yourself'; end if;

  -- Rate limit: max 120 sends per 10s per sender
  select count(*) into recent_sends
    from public.gift_sends
   where sender_id = sender
     and created_at > now() - interval '10 seconds';
  if recent_sends >= 120 then
    raise exception 'rate limit: too many gifts, slow down';
  end if;

  select * into g from public.gifts where id = _gift_id and coalesce(active, is_active);
  if not found then raise exception 'gift not found'; end if;

  host_share := public._current_host_gift_share();
  total_coins := coalesce(g.price_coins, g.price)::bigint * _quantity;
  diamonds_earned := floor(total_coins * host_share)::bigint
                     + (coalesce(g.diamonds_value, 0)::bigint * _quantity);

  perform set_config('app.trusted_definer', 'on', true);

  update public.profiles
     set coins = coins - total_coins
   where id = sender and coins >= total_coins
   returning coins into new_sender_coins;
  if not found then
    perform set_config('app.trusted_definer', 'off', true);
    raise exception 'insufficient coins';
  end if;

  update public.profiles
     set diamonds = diamonds + diamonds_earned
   where id = _receiver_id;

  perform set_config('app.trusted_definer', 'off', true);

  insert into public.gift_sends
    (room_id, sender_id, receiver_id, gift_id, quantity, coins_spent, diamonds_earned, finalized_at)
  values
    (_room_id, sender, _receiver_id, _gift_id, _quantity, total_coins, diamonds_earned, now())
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
end $function$
;
CREATE OR REPLACE FUNCTION public.send_gift(_room_id uuid, _receiver_id uuid, _gift_id uuid, _quantity integer DEFAULT 1, _write_message boolean DEFAULT true)
 RETURNS gift_sends
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  sender uuid := auth.uid();
  g public.gifts%rowtype;
  host_share numeric;
  total_coins bigint;
  diamonds_earned bigint;
  new_sender_coins bigint;
  send_row public.gift_sends;
  recent_sends int;
begin
  if sender is null then raise exception 'not signed in'; end if;
  if _quantity is null or _quantity < 1 then _quantity := 1; end if;
  if _receiver_id = sender then raise exception 'cannot gift yourself'; end if;

  select count(*) into recent_sends
    from public.gift_sends
   where sender_id = sender
     and created_at > now() - interval '10 seconds';
  if recent_sends >= 120 then
    raise exception 'rate limit: too many gifts, slow down';
  end if;

  select * into g from public.gifts where id = _gift_id and coalesce(active, is_active);
  if not found then raise exception 'gift not found'; end if;

  host_share := public._current_host_gift_share();
  total_coins := coalesce(g.price_coins, g.price)::bigint * _quantity;
  diamonds_earned := floor(total_coins * host_share)::bigint
                     + (coalesce(g.diamonds_value, 0)::bigint * _quantity);

  perform set_config('app.trusted_definer', 'on', true);

  update public.profiles
     set coins = coins - total_coins
   where id = sender and coins >= total_coins
   returning coins into new_sender_coins;
  if not found then
    perform set_config('app.trusted_definer', 'off', true);
    raise exception 'insufficient coins';
  end if;

  update public.profiles
     set diamonds = diamonds + diamonds_earned
   where id = _receiver_id;

  perform set_config('app.trusted_definer', 'off', true);

  insert into public.gift_sends
    (room_id, sender_id, receiver_id, gift_id, quantity, coins_spent, diamonds_earned, finalized_at)
  values
    (_room_id, sender, _receiver_id, _gift_id, _quantity, total_coins, diamonds_earned, now())
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

  if _room_id is not null and _write_message then
    insert into public.room_messages (room_id, user_id, kind, text, message, meta)
    values (_room_id, sender, 'gift', g.name, g.name,
      jsonb_build_object(
        'giftId', g.id, 'giftName', g.name, 'icon', coalesce(g.icon, g.emoji),
        'quantity', _quantity, 'coins', total_coins,
        'receiverId', _receiver_id, 'animation', g.animation
      ));
  end if;

  return send_row;
end $function$
;
CREATE OR REPLACE FUNCTION public.verify_room_pin(_room_id uuid, _pin text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.live_rooms
    WHERE id = _room_id AND (is_locked = false OR pin = _pin)
  );
$function$
;
