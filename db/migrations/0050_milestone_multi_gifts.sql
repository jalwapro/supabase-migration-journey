-- ============================================================================
-- Jalwa — allow up to 3 milestone gifts; host picks one on 100%
--   * Drops the "single milestone" uniqueness constraint.
--   * award_milestone_gift now takes an explicit _gift_id chosen by the host
--     (must be one of the admin-configured milestone gifts).
-- ============================================================================

drop index if exists public.idx_gifts_single_milestone;

-- Optional soft cap: allow admins to mark many, but the room UI shows up to 3.
create index if not exists idx_gifts_milestone
  on public.gifts (is_milestone) where is_milestone = true;

-- Drop the old 2-arg version and re-create with explicit gift id.
drop function if exists public.award_milestone_gift(uuid, uuid);

create or replace function public.award_milestone_gift(
  _room_id uuid,
  _receiver_id uuid,
  _gift_id uuid
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

  if exists (select 1 from public.live_rooms where id = _room_id and milestone_awarded_at is not null) then
    raise exception 'milestone already awarded for this room';
  end if;

  select coalesce(sum(coins_spent), 0)::bigint into coin_total
  from public.gift_sends where room_id = _room_id;

  if coin_total < 300000 then
    raise exception 'room not yet ranked (need 300k coins)';
  end if;

  select id, name, coalesce(emoji, icon, '🎁') as emoji into g
  from public.gifts
  where id = _gift_id
    and is_milestone = true
    and coalesce(is_active, active, true) = true
  limit 1;

  if g.id is null then
    raise exception 'selected gift is not an active milestone gift';
  end if;

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

grant execute on function public.award_milestone_gift(uuid, uuid, uuid) to authenticated;
