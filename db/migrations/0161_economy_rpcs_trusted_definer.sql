-- C7: Restore economy RPCs after profile guard (0156).
--
-- Problem: migration 0156 installed a BEFORE UPDATE trigger on public.profiles
-- that reverts privileged columns (coins, diamonds, is_vip, level, ...) unless
-- the caller is an admin OR the session-scoped marker `app.trusted_definer` is
-- set to 'on'. C2/C3/C4 wrapped `purchase_vip`, withdrawal RPCs and PK stake
-- RPCs with that marker, but the older SECURITY DEFINER economy RPCs
-- (send_gift, purchase_shop_item, spin_daily_wheel, play_lucky_spin,
-- finalize_room_gifts) still mutate coins/diamonds without setting the marker.
-- Inside those RPCs auth.uid() is still the caller's uid (not null) and the
-- caller is not admin, so the trigger silently reverts the UPDATE → gifts,
-- purchases, spins and payouts appear to succeed but balances never change.
--
-- Fix: re-declare each RPC with `set_config('app.trusted_definer', 'on', true)`
-- at the top and `'off'` at the end. The `true` third arg scopes the setting
-- to the current transaction so a crash inside the RPC still leaves the
-- session clean.

begin;

-- ---------------------------------------------------------------------------
-- 1. send_gift
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
  host_share constant numeric := 0.6;
  total_coins bigint;
  diamonds_earned bigint;
  new_sender_coins bigint;
  send_row public.gift_sends;
begin
  if sender is null then raise exception 'not signed in'; end if;
  if _quantity is null or _quantity < 1 then _quantity := 1; end if;
  if _receiver_id = sender then raise exception 'cannot gift yourself'; end if;

  select * into g from public.gifts where id = _gift_id and coalesce(active, is_active);
  if not found then raise exception 'gift not found'; end if;

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
end $$;

grant execute on function public.send_gift(uuid, uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. purchase_shop_item
-- ---------------------------------------------------------------------------
create or replace function public.purchase_shop_item(_theme_id uuid, _currency text default 'auto')
returns public.user_themes
language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _t public.themes%rowtype;
  _cur text;
  _price int;
  _expires timestamptz;
  _row public.user_themes;
begin
  if _uid is null then raise exception 'Sign in to buy'; end if;
  select * into _t from public.themes where id = _theme_id and is_active;
  if not found then raise exception 'Item not found'; end if;

  _cur := lower(coalesce(_currency, 'auto'));
  if _cur = 'auto' then
    _cur := case when _t.price_diamonds > 0 then 'diamonds' else 'coins' end;
  end if;
  if _cur not in ('coins','diamonds') then
    raise exception 'Invalid currency';
  end if;

  _price := case when _cur = 'diamonds' then _t.price_diamonds else _t.price end;
  if _price < 0 then raise exception 'Invalid price'; end if;

  if _price > 0 then
    perform set_config('app.trusted_definer', 'on', true);
    if _cur = 'diamonds' then
      update public.profiles
         set diamonds = diamonds - _price, updated_at = now()
       where id = _uid and diamonds >= _price;
      if not found then
        perform set_config('app.trusted_definer', 'off', true);
        raise exception 'Not enough diamonds';
      end if;
      insert into public.wallet_transactions (user_id, kind, diamonds_delta, ref_type, ref_id, note)
        values (_uid, 'shop_purchase', -_price, 'theme', _t.id, 'Bought ' || _t.name);
    else
      update public.profiles
         set coins = coins - _price, updated_at = now()
       where id = _uid and coins >= _price;
      if not found then
        perform set_config('app.trusted_definer', 'off', true);
        raise exception 'Not enough coins';
      end if;
      insert into public.wallet_transactions (user_id, kind, coins_delta, ref_type, ref_id, note)
        values (_uid, 'shop_purchase', -_price, 'theme', _t.id, 'Bought ' || _t.name);
    end if;
    perform set_config('app.trusted_definer', 'off', true);
  end if;

  if _t.duration_days is not null and _t.duration_days > 0 then
    _expires := now() + (_t.duration_days || ' days')::interval;
  else
    _expires := null;
  end if;

  insert into public.user_themes (user_id, theme_id, expires_at, purchased_price_diamonds)
    values (_uid, _theme_id, _expires,
            case when _cur = 'diamonds' then _price else 0 end)
    on conflict (user_id, theme_id) do update
      set expires_at = case
            when public.user_themes.expires_at is null then null
            when excluded.expires_at is null then null
            else greatest(public.user_themes.expires_at, now()) + (_t.duration_days || ' days')::interval
          end,
          purchased_price_diamonds = case when _cur = 'diamonds' then _price else public.user_themes.purchased_price_diamonds end
    returning * into _row;

  return _row;
end $$;

grant execute on function public.purchase_shop_item(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. spin_daily_wheel
-- ---------------------------------------------------------------------------
create or replace function public.spin_daily_wheel()
returns public.daily_spins
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  cooldown int;
  enabled boolean;
  last_next timestamptz;
  total_w int;
  r int;
  cum int := 0;
  chosen public.spin_prizes%rowtype;
  amount int;
  reward_theme uuid;
  spin public.daily_spins;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select daily_spin_cooldown_hours, daily_spin_enabled
    into cooldown, enabled
    from public.app_settings where id = 'global';
  if not coalesce(enabled, true) then raise exception 'daily spin is currently disabled'; end if;

  select next_spin_at into last_next
    from public.daily_spins where user_id = me
   order by spun_at desc limit 1;
  if last_next is not null and last_next > now() then
    raise exception 'next spin available at %', last_next;
  end if;

  select coalesce(sum(weight), 0) into total_w from public.spin_prizes where is_active;
  if total_w <= 0 then raise exception 'no prizes configured'; end if;

  r := 1 + floor(random() * total_w)::int;
  for chosen in
    select * from public.spin_prizes where is_active order by sort, id
  loop
    cum := cum + chosen.weight;
    if r <= cum then exit; end if;
  end loop;

  amount := chosen.min_amount
          + floor(random() * (greatest(chosen.max_amount - chosen.min_amount, 0) + 1))::int;
  reward_theme := null;

  perform set_config('app.trusted_definer', 'on', true);
  if chosen.kind = 'coins' then
    update public.profiles set coins = coins + amount, updated_at = now() where id = me;
  elsif chosen.kind = 'diamonds' then
    update public.profiles set diamonds = coalesce(diamonds, 0) + amount, updated_at = now() where id = me;
  elsif chosen.kind in ('theme','frame') then
    select t.id into reward_theme
      from public.themes t
      join public.theme_categories c on c.id = t.category_id
     where t.is_active
       and lower(c.slug) = case when chosen.kind = 'frame' then 'frame' else 'theme' end
     order by random() limit 1;
    if reward_theme is not null then
      insert into public.user_themes (user_id, theme_id)
        values (me, reward_theme)
        on conflict (user_id, theme_id) do nothing;
    end if;
  end if;
  perform set_config('app.trusted_definer', 'off', true);

  insert into public.daily_spins
    (user_id, prize_id, reward_kind, reward_amount, reward_label, granted_theme_id, next_spin_at)
  values
    (me, chosen.id, chosen.kind, amount, chosen.label, reward_theme,
     now() + (coalesce(cooldown, 24) || ' hours')::interval)
  returning * into spin;

  return spin;
end $$;
grant execute on function public.spin_daily_wheel() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. play_lucky_spin
-- ---------------------------------------------------------------------------
create or replace function public.play_lucky_spin(_bet int)
returns public.game_rounds
language plpgsql security definer set search_path = public as $$
declare
  sender uuid := auth.uid();
  g public.games;
  new_balance bigint;
  roll int;
  mult numeric(6,2);
  outc text;
  payout int;
  round_row public.game_rounds;
begin
  if sender is null then raise exception 'not authenticated'; end if;
  select * into g from public.games where slug = 'lucky_spin' and active;
  if not found then raise exception 'game not available'; end if;
  if _bet < g.min_bet or _bet > g.max_bet then
    raise exception 'bet out of range (% - %)', g.min_bet, g.max_bet;
  end if;

  perform set_config('app.trusted_definer', 'on', true);

  update public.profiles
     set coins = coins - _bet
   where id = sender and coins >= _bet
   returning coins into new_balance;
  if not found then
    perform set_config('app.trusted_definer', 'off', true);
    raise exception 'insufficient coins';
  end if;

  roll := floor(random() * 100) + 1;
  if roll <= 55 then       outc := 'lose'; mult := 0;
  elsif roll <= 80 then    outc := '1.5x'; mult := 1.5;
  elsif roll <= 93 then    outc := '2x';   mult := 2;
  elsif roll <= 99 then    outc := '5x';   mult := 5;
  else                     outc := '10x';  mult := 10;
  end if;

  payout := floor(_bet * mult);

  if payout > 0 then
    update public.profiles set coins = coins + payout
     where id = sender returning coins into new_balance;
  end if;

  perform set_config('app.trusted_definer', 'off', true);

  insert into public.game_rounds (game_id, user_id, bet_coins, outcome, multiplier, payout_coins)
  values (g.id, sender, _bet, outc, mult, payout)
  returning * into round_row;

  insert into public.wallet_transactions
    (user_id, kind, coins_delta, balance_coins_after, ref_type, ref_id, note)
  values
    (sender, 'game', payout - _bet, new_balance, 'game', round_row.id,
     'Lucky Spin: ' || outc);

  return round_row;
end $$;

grant execute on function public.play_lucky_spin(int) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. finalize_room_gifts
-- ---------------------------------------------------------------------------
create or replace function public.finalize_room_gifts(_room_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if _room_id is null then return; end if;

  perform set_config('app.trusted_definer', 'on', true);

  for r in
    select receiver_id, sum(diamonds_earned)::bigint as total_diamonds
      from public.gift_sends
     where room_id = _room_id
       and finalized_at is null
       and receiver_id is not null
     group by receiver_id
  loop
    if r.total_diamonds > 0 then
      update public.profiles
         set diamonds = diamonds + r.total_diamonds
       where id = r.receiver_id;

      insert into public.wallet_transactions
        (user_id, kind, diamonds_delta, ref_type, ref_id, note)
      values
        (r.receiver_id, 'gift_received', r.total_diamonds, 'room_gift', _room_id,
         'Room gifts finalized');
    end if;
  end loop;

  perform set_config('app.trusted_definer', 'off', true);

  update public.gift_sends
     set finalized_at = now()
   where room_id = _room_id
     and finalized_at is null;
end $$;

grant execute on function public.finalize_room_gifts(uuid) to authenticated, service_role;

commit;
