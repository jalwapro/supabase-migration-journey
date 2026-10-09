alter table public.profiles add column if not exists ban_reason text;

create table if not exists public.user_ban_appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  appeal_message text not null check (char_length(appeal_message) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_response text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

alter table public.user_ban_appeals enable row level security;
revoke all on public.user_ban_appeals from anon, authenticated;
grant all on public.user_ban_appeals to service_role;
