-- Add moderator flag on room_members so host can promote users.
alter table public.room_members
  add column if not exists is_moderator boolean not null default false;

-- Host may set/unset is_moderator on any member of their own room.
-- The existing "user updates own membership" policy stays as-is; add a
-- host-scoped update policy so host can toggle moderator on OTHER members.
drop policy if exists "host updates any member in own room" on public.room_members;
create policy "host updates any member in own room"
  on public.room_members for update
  to authenticated
  using (
    exists (
      select 1 from public.live_rooms r
      where r.id = room_members.room_id and r.host_id = auth.uid()
    )
    or public.is_admin(auth.uid())
  )
  with check (
    exists (
      select 1 from public.live_rooms r
      where r.id = room_members.room_id and r.host_id = auth.uid()
    )
    or public.is_admin(auth.uid())
  );
