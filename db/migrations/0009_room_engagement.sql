-- ============================================================================
-- Jalwa — room engagement: seat likes + real popularity
-- Removes the client-side mock counters. Popularity is derived from real
-- gift_sends totals so hosts can trust the number.
-- ============================================================================

-- ---------- room_seat_likes ----------------------------------------------
create table if not exists public.room_seat_likes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  seat_index int not null check (seat_index >= 0),
  liker_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_room_seat_likes_room
  on public.room_seat_likes(room_id, seat_index);
create index if not exists idx_room_seat_likes_liker
  on public.room_seat_likes(liker_id, created_at desc);

grant select, insert on public.room_seat_likes to authenticated;
grant select on public.room_seat_likes to anon;
grant all on public.room_seat_likes to service_role;

alter table public.room_seat_likes enable row level security;

drop policy if exists "seat likes public read" on public.room_seat_likes;
create policy "seat likes public read"
  on public.room_seat_likes for select using (true);

drop policy if exists "seat likes insert self" on public.room_seat_likes;
create policy "seat likes insert self"
  on public.room_seat_likes for insert to authenticated
  with check (liker_id = auth.uid());

-- ---------- like_room_seat RPC -------------------------------------------
create or replace function public.like_room_seat(
  _room_id uuid,
  _seat_index int
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  liker uuid := auth.uid();
  total int;
begin
  if liker is null then
    raise exception 'auth required';
  end if;

  insert into public.room_seat_likes(room_id, seat_index, liker_id)
  values (_room_id, _seat_index, liker);

  select count(*) into total
  from public.room_seat_likes
  where room_id = _room_id and seat_index = _seat_index;

  return total;
end;
$$;

grant execute on function public.like_room_seat(uuid, int) to authenticated;

-- ---------- room popularity view -----------------------------------------
create or replace view public.room_popularity as
  select
    r.id as room_id,
    coalesce(sum(gs.coins_spent), 0)::bigint as coin_score,
    coalesce(sum(gs.quantity), 0)::bigint as gift_count,
    (select count(*) from public.room_seat_likes sl where sl.room_id = r.id)::bigint as like_count
  from public.live_rooms r
  left join public.gift_sends gs on gs.room_id = r.id
  group by r.id;

grant select on public.room_popularity to anon, authenticated;
grant all on public.room_popularity to service_role;
