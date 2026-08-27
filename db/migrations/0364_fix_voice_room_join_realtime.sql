-- 0364: Fix audience joins so membership, viewer_count and entrance events
-- are created for normal authenticated users, not only the host.

-- Normal viewers must be able to create their own audience membership.
-- Seat claims remain protected by trg_guard_self_seat_claim (0350).
drop policy if exists "users can join own room membership" on public.room_members;
create policy "users can join own room membership"
  on public.room_members
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Make the membership insert the authoritative room-entry event source.
-- The existing viewer-count trigger (0049) increments live_rooms.viewer_count
-- and the existing realtime publication (0030/0350) propagates the row.
create or replace function public.trg_room_member_entrance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    -- fire_room_entrance uses auth.uid() and is invoked inside the same
    -- authenticated request that inserted the membership row.
    perform public.fire_room_entrance(NEW.room_id);
  exception when others then
    -- Entrance animation must never prevent a successful room join.
    null;
  end;
  return NEW;
end;
$$;

drop trigger if exists trg_room_member_entrance on public.room_members;
create trigger trg_room_member_entrance
after insert on public.room_members
for each row
execute function public.trg_room_member_entrance();

-- Keep the realtime publication explicitly enabled for the authoritative
-- membership/count/entrance tables.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_members'
  ) then
    execute 'alter publication supabase_realtime add table public.room_members';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'live_rooms'
  ) then
    execute 'alter publication supabase_realtime add table public.live_rooms';
  end if;
end $$;

-- Repair any stale count for rooms affected by earlier failed audience joins.
update public.live_rooms r
set viewer_count = coalesce((select count(*) from public.room_members m where m.room_id = r.id), 0)
where r.status = 'live';

notify pgrst, 'reload schema';
