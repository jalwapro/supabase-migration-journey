-- Allow any authenticated user to view another user's owned shop items
-- (needed for the "Owned items" section on public profile pages).

drop policy if exists "user themes public read" on public.user_themes;
create policy "user themes public read"
  on public.user_themes for select
  to authenticated
  using (true);
