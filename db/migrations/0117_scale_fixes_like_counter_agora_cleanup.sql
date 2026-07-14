-- =============================================================================
-- 10k-user scalability fixes (Phase 1)
-- =============================================================================
-- Fix 1: replace `select count(*) from room_seat_likes` on every like tap with
--        an incremental counter column on room_members. Table used to grow
--        unbounded and COUNT(*) got progressively slower — deadly in a popular
--        room where seat-liking is spam-tapped hundreds of times/sec.
--
-- Fix 2: retention job for room_seat_likes (keep only last 7 days) so the raw
--        table stops growing forever. Aggregate count lives on room_members.
--
-- Fix 3: drop legacy agora_slots infra — project migrated to ZEGO (see
--        migration 0114). Dead code / dead RPC surface = audit risk at scale.
-- =============================================================================

-- ---------- like_count counter on room_members --------------------------
alter table public.room_members
  add column if not exists like_count bigint not null default 0;

-- Backfill from existing raw likes so counts are correct after deploy.
-- (Only rows currently seated — audience members have no seat likes.)
update public.room_members m
   set like_count = coalesce(sub.n, 0)
  from (
    select room_id, seat_index, count(*)::bigint as n
      from public.room_seat_likes
     group by room_id, seat_index
  ) sub
 where m.room_id = sub.room_id
   and m.seat_index = sub.seat_index;

-- ---------- like_room_seat RPC — O(1) increment instead of COUNT(*) -----
drop function if exists public.like_room_seat(uuid, int);
create or replace function public.like_room_seat(
  _room_id uuid,
  _seat_index int
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  liker uuid := auth.uid();
  new_total bigint;
begin
  if liker is null then
    raise exception 'auth required';
  end if;

  -- Keep raw row for realtime broadcast fan-out (drives seat animations).
  insert into public.room_seat_likes(room_id, seat_index, liker_id)
  values (_room_id, _seat_index, liker);

  -- O(1) counter bump — no scan.
  update public.room_members
     set like_count = like_count + 1
   where room_id = _room_id
     and seat_index = _seat_index
   returning like_count into new_total;

  return coalesce(new_total, 0);
end;
$$;

grant execute on function public.like_room_seat(uuid, int) to authenticated;

-- ---------- retention: prune old raw likes ------------------------------
-- Keep only the last 7 days of raw like rows. Aggregate count is on
-- room_members so historical accuracy is preserved.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('prune_room_seat_likes')
      where exists (select 1 from cron.job where jobname = 'prune_room_seat_likes');
    perform cron.schedule(
      'prune_room_seat_likes',
      '17 3 * * *',
      $cron$ delete from public.room_seat_likes where created_at < now() - interval '7 days' $cron$
    );
  end if;
exception when others then
  -- pg_cron not installed on this project — that's fine, cleanup can run
  -- manually or via a scheduled server function later.
  null;
end $$;

-- ---------- drop legacy agora_slots (project uses ZEGO now) --------------
drop function if exists public.consume_agora_slot(text, numeric);
drop table if exists public.agora_slots;

notify pgrst, 'reload schema';
