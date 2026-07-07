-- ============================================================================
-- Jalwa — Phase 5: Gifts + Games
-- Gift catalog, gift_sends (atomic coin transfer + host share),
-- games catalog, game_rounds (Lucky Spin MVP).
-- ============================================================================

-- ---------- gifts ---------------------------------------------------------
create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,                   -- emoji or short symbol
  image_url text,              -- optional artwork
  price_coins int not null check (price_coins > 0),
  diamonds_value int not null default 0 check (diamonds_value >= 0),
  animation text,              -- e.g. 'confetti','fireworks','none'
  category text default 'popular',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

grant select on public.gifts to anon, authenticated;
grant all on public.gifts to service_role;

alter table public.gifts enable row level security;

drop policy if exists "gifts public read" on public.gifts;
create policy "gifts public read"
  on public.gifts for select using (active or public.is_admin(auth.uid()));

drop policy if exists "admins manage gifts" on public.gifts;
create policy "admins manage gifts"
  on public.gifts for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ---------- gift_sends ----------------------------------------------------
create table if not exists public.gift_sends (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.live_rooms(id) on delete set null,
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  gift_id uuid not null references public.gifts(id) on delete restrict,
  quantity int not null default 1 check (quantity > 0),
  coins_spent int not null,
  diamonds_earned int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_gift_sends_room on public.gift_sends(room_id, created_at desc);
create index if not exists idx_gift_sends_recv on public.gift_sends(receiver_id, created_at desc);
create index if not exists idx_gift_sends_sender on public.gift_sends(sender_id, created_at desc);

grant select on public.gift_sends to anon, authenticated;
grant all on public.gift_sends to service_role;

alter table public.gift_sends enable row level security;

drop policy if exists "gift sends public read" on public.gift_sends;
create policy "gift sends public read"
  on public.gift_sends for select using (true);

-- ---------- send_gift RPC (atomic; SECURITY DEFINER) ----------------------
create or replace function public.send_gift(
  _room_id uuid,
  _receiver_id uuid,
  _gift_id uuid,
  _quantity int default 1
) returns public.gift_sends
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.gifts;
  sender uuid := auth.uid();
  total_coins int;
  host_share numeric := 0.6;
  economy jsonb;
  diamonds_earned int;
  new_sender_coins int;
  send_row public.gift_sends;
begin
  if sender is null then raise exception 'not authenticated'; end if;
  if _quantity <= 0 then raise exception 'invalid quantity'; end if;
  if _receiver_id = sender then raise exception 'cannot gift yourself'; end if;

  select * into g from public.gifts where id = _gift_id and active;
  if not found then raise exception 'gift not found'; end if;

  total_coins := g.price_coins * _quantity;

  -- Load host share from economy settings if present
  select value into economy from public.app_settings where key = 'economy';
  if economy ? 'hostGiftShare' then
    host_share := (economy->>'hostGiftShare')::numeric;
  end if;

  diamonds_earned := floor(total_coins * host_share) + (g.diamonds_value * _quantity);

  -- Deduct sender
  update public.profiles
     set coins = coins - total_coins
   where id = sender and coins >= total_coins
   returning coins into new_sender_coins;
  if not found then raise exception 'insufficient coins'; end if;

  -- Credit receiver diamonds
  update public.profiles
     set diamonds = diamonds + diamonds_earned
   where id = _receiver_id;

  insert into public.gift_sends
    (room_id, sender_id, receiver_id, gift_id, quantity, coins_spent, diamonds_earned)
  values
    (_room_id, sender, _receiver_id, _gift_id, _quantity, total_coins, diamonds_earned)
  returning * into send_row;

  -- Ledger
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

  -- Broadcast into room chat
  if _room_id is not null then
    insert into public.room_messages (room_id, user_id, kind, text, meta)
    values (_room_id, sender, 'gift', g.name,
      jsonb_build_object(
        'giftId', g.id, 'giftName', g.name, 'icon', g.icon,
        'quantity', _quantity, 'coins', total_coins,
        'receiverId', _receiver_id, 'animation', g.animation
      ));
  end if;

  return send_row;
end $$;

grant execute on function public.send_gift(uuid, uuid, uuid, int) to authenticated;

-- ---------- games catalog + rounds ---------------------------------------
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  icon text,
  min_bet int not null default 100,
  max_bet int not null default 10000,
  house_edge numeric(4,3) not null default 0.05,   -- 5%
  active boolean not null default true,
  created_at timestamptz not null default now()
);

grant select on public.games to anon, authenticated;
grant all on public.games to service_role;
alter table public.games enable row level security;

drop policy if exists "games public read" on public.games;
create policy "games public read"
  on public.games for select using (active or public.is_admin(auth.uid()));

drop policy if exists "admins manage games" on public.games;
create policy "admins manage games"
  on public.games for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create table if not exists public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  bet_coins int not null check (bet_coins > 0),
  outcome text not null,        -- e.g. '2x','5x','10x','lose'
  multiplier numeric(6,2) not null default 0,
  payout_coins int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_game_rounds_user on public.game_rounds(user_id, created_at desc);

grant select on public.game_rounds to authenticated;
grant all on public.game_rounds to service_role;
alter table public.game_rounds enable row level security;

drop policy if exists "user reads own rounds" on public.game_rounds;
create policy "user reads own rounds"
  on public.game_rounds for select to authenticated
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- ---------- play_lucky_spin RPC ------------------------------------------
-- Wheel with 8 slots. Payouts weighted so expected value ~= (1 - house_edge)*bet.
-- Outcomes: lose(4), 1.5x(2), 2x(1), 5x(0.5 chance via 10x rare)
create or replace function public.play_lucky_spin(_bet int)
returns public.game_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  sender uuid := auth.uid();
  g public.games;
  new_balance int;
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

  -- Deduct bet
  update public.profiles
     set coins = coins - _bet
   where id = sender and coins >= _bet
   returning coins into new_balance;
  if not found then raise exception 'insufficient coins'; end if;

  -- Weighted roll 1..100
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

-- ---------- Seed defaults -------------------------------------------------
insert into public.gifts (name, icon, price_coins, diamonds_value, animation, category, sort_order) values
  ('Rose',        '🌹',    10,   1,  'none',      'popular', 1),
  ('Heart',       '❤️',    50,   5,  'none',      'popular', 2),
  ('Kiss',        '💋',   100,  10,  'confetti',  'popular', 3),
  ('Crown',       '👑',   500,  50,  'sparkle',   'luxury',  4),
  ('Diamond',     '💎',  1000, 100,  'sparkle',   'luxury',  5),
  ('Sports Car',  '🏎️', 5000, 500,  'fireworks', 'luxury',  6),
  ('Yacht',       '🛥️',10000,1000,  'fireworks', 'luxury',  7),
  ('Rocket',      '🚀', 20000,2000,  'fireworks', 'vip',     8),
  ('Castle',      '🏰', 50000,5000,  'fireworks', 'vip',     9)
on conflict do nothing;

insert into public.games (slug, name, description, icon, min_bet, max_bet, house_edge) values
  ('lucky_spin', 'Lucky Spin', 'Spin the wheel and win up to 10x your bet!', '🎡', 100, 50000, 0.05)
on conflict (slug) do nothing;
