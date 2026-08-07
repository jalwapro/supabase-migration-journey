-- 0307_slots.sql — "Jalwa 777 Slots"
-- Server-authoritative slot machine using the app's real profiles.coins
-- balance (same coins used everywhere else — Ludo, mini games, gifts).
-- Client NEVER computes a result; it only renders whatever slots_spin()
-- returns. This mirrors the mg_start_session/mg_finish_session pattern
-- already used for mini games (atomic balance guard + anti-cheat).
begin;

-- Single-row config: symbol weights/payouts + bet limits + free-spin rules.
create table if not exists public.slots_config (
  id boolean primary key default true check (id),
  min_bet bigint not null default 10,
  max_bet bigint not null default 10000,
  -- Each symbol: weight = how often it appears, mult = payout multiplier
  -- when all 3 reels land on it (on the middle/pay row).
  symbols jsonb not null default '[
    {"symbol":"cherry",  "icon":"🍒", "weight":38, "mult":2,   "two_mult":0.3},
    {"symbol":"bell",    "icon":"🔔", "weight":24, "mult":5,   "two_mult":0.5},
    {"symbol":"moneybag","icon":"💰", "weight":16, "mult":10,  "two_mult":1},
    {"symbol":"crown",   "icon":"👑", "weight":10, "mult":25,  "two_mult":2},
    {"symbol":"diamond", "icon":"💎", "weight":6,  "mult":50,  "two_mult":4},
    {"symbol":"777",     "icon":"7️⃣", "weight":2,  "mult":100, "two_mult":8, "jackpot": true},
    {"symbol":"star",    "icon":"⭐", "weight":4,  "mult":0,   "two_mult":0, "free_spins": 5}
  ]'::jsonb,
  jackpot_contribution_bp int not null default 50,  -- 0.50% of every bet feeds the jackpot
  jackpot_seed bigint not null default 100000,
  updated_at timestamptz not null default now()
);
insert into public.slots_config (id) values (true) on conflict (id) do nothing;

-- Single running jackpot value, shown live in the UI.
create table if not exists public.slots_jackpot (
  id boolean primary key default true check (id),
  current_value bigint not null default 100000,
  updated_at timestamptz not null default now()
);
insert into public.slots_jackpot (id, current_value)
  select true, c.jackpot_seed from public.slots_config c
  on conflict (id) do nothing;

-- Per-user free spins balance (awarded when 3x ⭐ land).
create table if not exists public.slots_free_spins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  remaining int not null default 0,
  updated_at timestamptz not null default now()
);

-- Every spin, for the "Recent Winners" feed + fraud auditing.
create table if not exists public.slots_spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid,
  bet bigint not null,
  was_free_spin boolean not null default false,
  reels jsonb not null,        -- [{top,mid,bottom}, {...}, {...}] for the 3 reels
  payout bigint not null default 0,
  is_jackpot boolean not null default false,
  free_spins_awarded int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_slots_spins_recent on public.slots_spins (created_at desc);
create index if not exists idx_slots_spins_user on public.slots_spins (user_id, created_at desc);

grant select on public.slots_config, public.slots_jackpot to anon, authenticated;
grant select on public.slots_spins to authenticated;
alter table public.slots_config enable row level security;
alter table public.slots_jackpot enable row level security;
alter table public.slots_free_spins enable row level security;
alter table public.slots_spins enable row level security;

drop policy if exists "slots_config read" on public.slots_config;
create policy "slots_config read" on public.slots_config for select using (true);
drop policy if exists "slots_jackpot read" on public.slots_jackpot;
create policy "slots_jackpot read" on public.slots_jackpot for select using (true);
drop policy if exists "slots_spins read recent" on public.slots_spins;
create policy "slots_spins read recent" on public.slots_spins for select using (true);
drop policy if exists "slots_free_spins own" on public.slots_free_spins;
create policy "slots_free_spins own" on public.slots_free_spins
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- The one function the client calls. Everything — bet debit, RNG, payout,
-- jackpot, free spins — happens atomically inside this transaction.
-- ---------------------------------------------------------------------------
create or replace function public.slots_spin(p_bet bigint, p_room_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  cfg public.slots_config%rowtype;
  bal bigint;
  free_left int := 0;
  used_free boolean := false;
  syms jsonb;
  total_w numeric := 0;
  i int;
  reel_result text[3];
  reel_grid jsonb[3];
  roll numeric;
  cum numeric;
  sym jsonb;
  mid1 text; mid2 text; mid3 text;
  payout bigint := 0;
  is_jack boolean := false;
  free_awarded int := 0;
  jackpot_val bigint;
  spin_count_1m int;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select * into cfg from public.slots_config where id = true;
  if not found then raise exception 'slots not configured'; end if;

  -- basic rate limit / anti-abuse
  select count(*) into spin_count_1m from public.slots_spins
    where user_id = me and created_at > now() - interval '1 minute';
  if spin_count_1m > 90 then
    raise exception 'Too many spins, slow down';
  end if;

  if p_bet < cfg.min_bet or p_bet > cfg.max_bet then
    raise exception 'Bet must be between % and %', cfg.min_bet, cfg.max_bet;
  end if;

  -- free spin?
  select remaining into free_left from public.slots_free_spins where user_id = me for update;
  if free_left is not null and free_left > 0 then
    used_free := true;
    update public.slots_free_spins set remaining = remaining - 1, updated_at = now() where user_id = me;
  else
    update public.profiles set coins = coins - p_bet
      where id = me and coins >= p_bet;
    if not found then raise exception 'Not enough coins'; end if;
  end if;

  -- weighted symbol pool
  syms := cfg.symbols;
  select sum((s->>'weight')::numeric) into total_w from jsonb_array_elements(syms) s;

  -- spin 3 reels; each reel's "mid" is the payline symbol, top/bottom are cosmetic
  for i in 1..3 loop
    roll := random() * total_w;
    cum := 0;
    for sym in select * from jsonb_array_elements(syms) loop
      cum := cum + (sym->>'weight')::numeric;
      if roll <= cum then
        reel_result[i] := sym->>'symbol';
        exit;
      end if;
    end loop;
    if reel_result[i] is null then reel_result[i] := syms->0->>'symbol'; end if;
  end loop;

  mid1 := reel_result[1]; mid2 := reel_result[2]; mid3 := reel_result[3];

  -- payout: 3-of-a-kind on the payline, else 2-of-a-kind consolation
  if mid1 = mid2 and mid2 = mid3 then
    select sym into sym from jsonb_array_elements(syms) sym where sym->>'symbol' = mid1;
    payout := (p_bet * coalesce((sym->>'mult')::numeric, 0))::bigint;
    if coalesce((sym->>'jackpot')::boolean, false) then
      is_jack := true;
    end if;
    if coalesce((sym->>'free_spins')::int, 0) > 0 then
      free_awarded := (sym->>'free_spins')::int;
    end if;
  elsif mid1 = mid2 or mid2 = mid3 or mid1 = mid3 then
    select sym into sym from jsonb_array_elements(syms) sym
      where sym->>'symbol' = (case when mid1 = mid2 then mid1 when mid2 = mid3 then mid2 else mid1 end);
    payout := (p_bet * coalesce((sym->>'two_mult')::numeric, 0))::bigint;
  end if;

  -- jackpot pool: grows from every real-money spin's bet, paid out + reset on 777x3
  if not used_free then
    update public.slots_jackpot set current_value = current_value + (p_bet * cfg.jackpot_contribution_bp / 10000), updated_at = now()
      where id = true;
  end if;
  if is_jack then
    select current_value into jackpot_val from public.slots_jackpot where id = true for update;
    payout := payout + jackpot_val;
    update public.slots_jackpot set current_value = cfg.jackpot_seed, updated_at = now() where id = true;
  end if;

  if payout > 0 then
    update public.profiles set coins = coins + payout where id = me;
  end if;

  if free_awarded > 0 then
    insert into public.slots_free_spins (user_id, remaining)
      values (me, free_awarded)
      on conflict (user_id) do update set remaining = slots_free_spins.remaining + free_awarded, updated_at = now();
  end if;

  select coins into bal from public.profiles where id = me;
  select remaining into free_left from public.slots_free_spins where user_id = me;
  select current_value into jackpot_val from public.slots_jackpot where id = true;

  insert into public.slots_spins (user_id, room_id, bet, was_free_spin, reels, payout, is_jackpot, free_spins_awarded)
  values (me, p_room_id, p_bet, used_free, to_jsonb(reel_result), payout, is_jack, free_awarded);

  return jsonb_build_object(
    'reels', reel_result,
    'bet', p_bet,
    'was_free_spin', used_free,
    'payout', payout,
    'is_jackpot', is_jack,
    'free_spins_awarded', free_awarded,
    'free_spins_remaining', coalesce(free_left, 0),
    'balance', bal,
    'jackpot', jackpot_val
  );
end;
$$;

grant execute on function public.slots_spin(bigint, uuid) to authenticated;

commit;
