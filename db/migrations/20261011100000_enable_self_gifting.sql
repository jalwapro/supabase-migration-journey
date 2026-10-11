-- Allow intentional self-gifting in the single, combo, and multi-recipient RPCs.
-- Coins are still deducted and diamonds credited through the existing atomic accounting path.
BEGIN;

create or replace function public.send_gift(
  _room_id uuid, _receiver_id uuid, _gift_id uuid, _quantity int default 1
) returns public.gift_sends
language plpgsql security definer set search_path = public as $$
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
end $$;

create or replace function public.send_gift(
  _room_id uuid,
  _receiver_id uuid,
  _gift_id uuid,
  _quantity int default 1,
  _write_message boolean default true
) returns public.gift_sends
language plpgsql security definer set search_path = public as $$
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
end $$;

create or replace function public.send_gift_multi_current(
  _room_id uuid,
  _receiver_ids uuid[],
  _gift_id uuid,
  _quantity integer
)
returns setof public.gift_sends
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_receiver uuid;
  v_seen uuid[] := array[]::uuid[];
begin
  if v_sender is null then raise exception 'Not authenticated'; end if;
  if _room_id is null or _gift_id is null then raise exception 'Gift parameters are required'; end if;
  if _receiver_ids is null or cardinality(_receiver_ids) < 1 or cardinality(_receiver_ids) > 20 then raise exception 'Invalid receiver count'; end if;
  if _quantity is null or _quantity < 1 or _quantity > 100 then raise exception 'Invalid quantity'; end if;

  foreach v_receiver in array _receiver_ids loop
    if v_receiver is null then
      raise exception 'Invalid gift receiver';
    end if;
    if v_receiver = any(v_seen) then
      continue;
    end if;
    v_seen := array_append(v_seen, v_receiver);

    if not exists (
      select 1
      from public.room_members rm
      where rm.room_id = _room_id
        and rm.user_id = v_receiver
    )
    and not exists (
      select 1
      from public.live_rooms r
      where r.id = _room_id
        and r.host_id = v_receiver
    ) then
      raise exception 'Receiver is not an active member of this room';
    end if;

    return next public.send_gift(_room_id, v_receiver, _gift_id, _quantity, false);
  end loop;

  if cardinality(v_seen) < 1 then raise exception 'Pick a receiver'; end if;
  return;
end;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
