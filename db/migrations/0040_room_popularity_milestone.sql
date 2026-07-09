-- ============================================================================
-- Jalwa — room popularity milestone & rank
--
-- Rules:
--   * 3,000 coins spent in a room = 1% popularity (0..100).
--   * At 300,000 coins the room is "ranked" and eligible for the milestone
--     gift award. Host sees the room's top gifters and picks one; the admin-
--     configured milestone gift is played for that user (free, room-sponsored).
-- ============================================================================

-- ── milestone gift flag ────────────────────────────────────────────────
alter table public.gifts
  add column if not exists is_milestone boolean not null default false;

-- Enforce a single active milestone gift.
create unique index if not exists idx_gifts_single_milestone
  on public.gifts ((true))
  where is_milestone = true;

-- ── per-room milestone award tracking ──────────────────────────────────
alter table public.live_rooms
  add column if not exists milestone_awarded_at timestamptz,
  add column if not exists milestone_receiver_id uuid references auth.users(id) on delete set null,
  add column if not exists milestone_gift_id uuid references public.gifts(id) on delete set null;

-- ── top gifters in a room (ordered) ────────────────────────────────────
create or replace function public.room_top_gifters(_room_id uuid, _limit int default 20)
returns table (
  user_id uuid,
  username text,
  avatar text,
  total_coins bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    gs.sender_id as user_id,
    p.username,
    p.avatar,
    sum(gs.coins_spent)::bigint as total_coins
  from public.gift_sends gs
  left join public.profiles p on p.id = gs.sender_id
  where gs.room_id = _room_id
    and gs.sender_id is not null
  group by gs.sender_id, p.username, p.avatar
  order by total_coins desc
  limit _limit;
$$;

grant execute on function public.room_top_gifters(uuid, int) to authenticated, anon;

-- ── award milestone gift (host-only, idempotent, coin_score >= 300k) ───
create or replace function public.award_milestone_gift(
  _room_id uuid,
  _receiver_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  host uuid;
  coin_total bigint;
  g record;
  event_id uuid;
begin
  if caller is null then
    raise exception 'auth required';
  end if;

  select host_id into host from public.live_rooms where id = _room_id;
  if host is null then
    raise exception 'room not found';
  end if;
  if host <> caller then
    raise exception 'only host can award milestone';
  end if;

  -- Idempotent: if already awarded, return existing event (best-effort null).
  if exists (select 1 from public.live_rooms where id = _room_id and milestone_awarded_at is not null) then
    raise exception 'milestone already awarded for this room';
  end if;

  select coalesce(sum(coins_spent), 0)::bigint into coin_total
  from public.gift_sends where room_id = _room_id;

  if coin_total < 300000 then
    raise exception 'room not yet ranked (need 300k coins)';
  end if;

  select id, name, coalesce(emoji, icon, '🎁') as emoji into g
  from public.gifts where is_milestone = true and coalesce(is_active, active, true) = true
  limit 1;

  if g.id is null then
    raise exception 'no milestone gift configured';
  end if;

  -- Play the animation for everyone in the room via gift_events.
  insert into public.gift_events (room_id, sender_id, sender_name, gift_id, gift_emoji, gift_name, coins)
  select _room_id, host, coalesce(hp.username, 'Host'), g.id, g.emoji, g.name, 0
  from public.profiles hp where hp.id = host
  returning id into event_id;

  update public.live_rooms
    set milestone_awarded_at = now(),
        milestone_receiver_id = _receiver_id,
        milestone_gift_id = g.id
    where id = _room_id;

  return event_id;
end;
$$;

grant execute on function public.award_milestone_gift(uuid, uuid) to authenticated;
