-- ============================================================================
-- Area 2 audit fixes: Gifts + Economy
--
-- Fixes:
--   1. Combo send_gift(uuid,uuid,uuid,int,bool) overload was created in 0119
--      without the `app.trusted_definer` marker, so 0156's profile guard
--      silently reverted coin/diamond UPDATEs on every combo tap (rows still
--      written to gift_sends + wallet_transactions → ledger diverged from
--      actual balances).
--   2. Every send_gift version since 0092 credits receiver diamonds
--      immediately AND leaves finalized_at NULL, so finalize_room_gifts
--      (called on every room close and PK end) re-credits the same diamonds
--      → double-mint on every room close. Fix: stamp finalized_at = now()
--      at insert time so finalize is a no-op for those rows.
--   3. host_share was hardcoded 0.6 in every send_gift; the admin-editable
--      app_kv 'economy'.hostGiftShare setting had zero effect. Now read live.
--   4. public.gifts had INSERT/UPDATE/DELETE granted to `authenticated`;
--      only RLS stood between any signed-in user and full catalog control.
--      Restrict table grants to service_role + admins.
--   5. log_combo_gift_summary accepted a client-supplied _total_quantity
--      with no verification, letting anyone spoof arbitrary combo sizes in
--      room chat. Now clamps to the caller's actual recent gift_sends sum
--      for that receiver + gift within the last 30 seconds.
--   6. Rate-limit send_gift: max 120 sends per 10s per sender.
-- ============================================================================

begin;

-- Helper: current host-share from app_kv, default 0.6
create or replace function public._current_host_gift_share()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif((value->>'hostGiftShare'), '')::numeric,
    0.6
  )
  from public.app_kv
  where key = 'economy'
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- send_gift (4-arg): trusted_definer + finalized_at stamp + live host-share
-- ---------------------------------------------------------------------------
drop function if exists public.send_gift(uuid, uuid, uuid, integer);
drop function if exists public.send_gift(uuid, uuid, uuid, int);

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
end $$;

grant execute on function public.send_gift(uuid, uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- send_gift (5-arg, combo): same fixes + honor _write_message flag
-- ---------------------------------------------------------------------------
drop function if exists public.send_gift(uuid, uuid, uuid, integer, boolean);

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
end $$;

grant execute on function public.send_gift(uuid, uuid, uuid, integer, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- log_combo_gift_summary: clamp _total_quantity to actually-paid recent sends
-- ---------------------------------------------------------------------------
create or replace function public.log_combo_gift_summary(
  _room_id uuid,
  _receiver_id uuid,
  _gift_id uuid,
  _total_quantity int
) returns void
language plpgsql security definer set search_path = public as $$
declare
  sender uuid := auth.uid();
  g public.gifts%rowtype;
  actual_qty bigint;
  total_coins bigint;
begin
  if sender is null then raise exception 'not signed in'; end if;
  if _total_quantity is null or _total_quantity < 1 then return; end if;
  if _room_id is null then return; end if;

  select * into g from public.gifts where id = _gift_id;
  if not found then return; end if;

  -- Ownership + honesty check: cap at actual sends by this sender for this
  -- receiver+gift in this room over the last 30s.
  select coalesce(sum(quantity), 0) into actual_qty
    from public.gift_sends
   where sender_id = sender
     and receiver_id = _receiver_id
     and gift_id = _gift_id
     and room_id = _room_id
     and created_at > now() - interval '30 seconds';

  if actual_qty <= 0 then return; end if;
  if _total_quantity > actual_qty then _total_quantity := actual_qty::int; end if;

  total_coins := coalesce(g.price_coins, g.price)::bigint * _total_quantity;

  insert into public.room_messages (room_id, user_id, kind, text, message, meta)
  values (_room_id, sender, 'gift', g.name, g.name,
    jsonb_build_object(
      'giftId', g.id, 'giftName', g.name, 'icon', coalesce(g.icon, g.emoji),
      'quantity', _total_quantity, 'coins', total_coins,
      'receiverId', _receiver_id, 'animation', g.animation,
      'combo', true
    ));
end $$;

grant execute on function public.log_combo_gift_summary(uuid, uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Tighten public.gifts table grants: only admins (via RLS) + service_role
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.gifts from authenticated;
grant select on public.gifts to anon, authenticated;
grant all on public.gifts to service_role;

commit;

notify pgrst, 'reload schema';
