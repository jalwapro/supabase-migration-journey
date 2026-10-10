-- 0311: Royal JALWA Slots — native room-game entry and authenticated wallet wrapper.
-- Uses the existing server-authoritative slot engine and real profiles.coins.
begin;

-- Idempotency cache: one authenticated user + request UUID can settle only once.
create table if not exists public.royal_jalwa_slot_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table public.royal_jalwa_slot_requests enable row level security;
revoke all on table public.royal_jalwa_slot_requests from public, anon, authenticated;

insert into public.room_games
  (slug, name, subtitle, kind, category, game_url, enabled, visible, sort_order)
values
  ('royal_jalwa_slots', 'Royal JALWA', 'Golden reels · real JALWA coins', 'native', 'casino', null, true, true, 25)
on conflict (slug) do update
  set name = excluded.name,
      subtitle = excluded.subtitle,
      kind = 'native',
      category = 'casino',
      game_url = null,
      enabled = true,
      visible = true;

-- slots_spin predates the trusted-profile trigger marker. Set the transaction-local
-- marker in this authenticated wrapper before the existing atomic spin/debit/payout.
-- The called RPC still derives the user exclusively from auth.uid() and generates
-- all reel outcomes and payouts on the server. No client-supplied result is accepted.
create or replace function public.royal_jalwa_slots_spin(
  p_bet bigint,
  p_request_id uuid,
  p_room_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $
declare
  me uuid := auth.uid();
  round_result jsonb;
  prior_result jsonb;
  round_payout bigint;
  round_balance bigint;
  free_spin boolean;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if p_request_id is null then
    raise exception 'request id required';
  end if;

  -- Serialize duplicate retries with the same idempotency key.
  perform pg_advisory_xact_lock(hashtextextended(me::text || ':' || p_request_id::text, 0));
  select result into prior_result
    from public.royal_jalwa_slot_requests
   where user_id = me and request_id = p_request_id;
  if found then
    return prior_result;
  end if;

  perform set_config('app.trusted_definer', 'on', true);
  round_result := public.slots_spin(p_bet, p_room_id);
  round_payout := coalesce((round_result->>'payout')::bigint, 0);
  round_balance := coalesce((round_result->>'balance')::bigint, 0);
  free_spin := coalesce((round_result->>'was_free_spin')::boolean, false);

  -- Keep the existing wallet ledger in sync with the authoritative slot round.
  -- The slots engine has already atomically applied the debit and payout.
  if not free_spin then
    insert into public.wallet_transactions
      (user_id, kind, coins_delta, balance_coins_after, ref_type, note)
    values
      (me, 'game', -p_bet, round_balance - round_payout, 'royal_jalwa_slots',
       'Royal JALWA slot bet');
  end if;

  if round_payout > 0 then
    insert into public.wallet_transactions
      (user_id, kind, coins_delta, balance_coins_after, ref_type, note)
    values
      (me, 'game_reward', round_payout, round_balance, 'royal_jalwa_slots',
       'Royal JALWA slot payout');
  end if;

  return round_result;
end;
$;

revoke all on function public.royal_jalwa_slots_spin(bigint, uuid) from public, anon;
grant execute on function public.royal_jalwa_slots_spin(bigint, uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
