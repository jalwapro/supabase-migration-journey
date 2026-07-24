-- ============================================================================
-- C5 — Consolidate duplicate room tables.
--
-- The app has fully migrated to `public.live_rooms` (see migrations 0002,
-- 0035, 0114, 0117, 0120, 0150, 0151, 0154). The legacy `public.rooms`
-- table is empty (0 rows) but four dependent tables still FK into it:
--   chat_emoji_sends, gift_events, pk_battles, room_participants
--
-- Verified state before this migration:
--   - rooms:              0 rows
--   - gift_events:        0 rows
--   - pk_battles:         0 rows
--   - room_participants:  0 rows
--   - chat_emoji_sends:   13 rows, ALL with room_id IS NULL (DM emojis only)
--
-- So we can safely repoint every FK from `rooms` → `live_rooms`
-- and drop the legacy table without data loss.
-- ============================================================================

-- 1. Repoint FKs to live_rooms.
alter table public.chat_emoji_sends
  drop constraint if exists chat_emoji_sends_room_id_fkey;
alter table public.chat_emoji_sends
  add constraint chat_emoji_sends_room_id_fkey
  foreign key (room_id) references public.live_rooms(id) on delete cascade;

alter table public.gift_events
  drop constraint if exists gift_events_room_id_fkey;
alter table public.gift_events
  add constraint gift_events_room_id_fkey
  foreign key (room_id) references public.live_rooms(id) on delete cascade;

alter table public.pk_battles
  drop constraint if exists pk_battles_room_id_fkey;
alter table public.pk_battles
  add constraint pk_battles_room_id_fkey
  foreign key (room_id) references public.live_rooms(id) on delete set null;

alter table public.room_participants
  drop constraint if exists room_participants_room_id_fkey;
alter table public.room_participants
  add constraint room_participants_room_id_fkey
  foreign key (room_id) references public.live_rooms(id) on delete cascade;

-- 2. Drop the legacy table. CASCADE clears any leftover policies/indexes.
--    Safety guard: refuse to drop if anything got inserted in the meantime.
do $$
declare
  n bigint;
begin
  select count(*) into n from public.rooms;
  if n > 0 then
    raise exception 'Refusing to drop public.rooms — % row(s) present. Migrate data first.', n;
  end if;
end $$;

drop table if exists public.rooms cascade;

notify pgrst, 'reload schema';
