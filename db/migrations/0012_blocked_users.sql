-- Blocked users table
create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

grant select, insert, delete on public.blocked_users to authenticated;
grant all on public.blocked_users to service_role;

alter table public.blocked_users enable row level security;

drop policy if exists "user reads own blocks" on public.blocked_users;
create policy "user reads own blocks" on public.blocked_users
  for select to authenticated using (blocker_id = auth.uid());

drop policy if exists "user creates own blocks" on public.blocked_users;
create policy "user creates own blocks" on public.blocked_users
  for insert to authenticated with check (blocker_id = auth.uid());

drop policy if exists "user removes own blocks" on public.blocked_users;
create policy "user removes own blocks" on public.blocked_users
  for delete to authenticated using (blocker_id = auth.uid());

create index if not exists idx_blocked_users_blocker on public.blocked_users(blocker_id);

notify pgrst, 'reload schema';
