-- ============================================================================
-- 0152 — Lightweight user presence for online/offline gating
-- Used by: PK challenge picker, seat invites, DM online dot.
-- ============================================================================

create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

create index if not exists user_presence_last_seen_idx
  on public.user_presence (last_seen_at desc);

grant select on public.user_presence to authenticated;
grant all    on public.user_presence to service_role;

alter table public.user_presence enable row level security;

drop policy if exists "presence public read" on public.user_presence;
create policy "presence public read"
  on public.user_presence for select
  to authenticated
  using (true);

-- Users touch their own row via RPC only (avoids RLS write policy).
create or replace function public.touch_presence()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then return; end if;
  insert into public.user_presence(user_id, last_seen_at)
    values (me, now())
  on conflict (user_id) do update set last_seen_at = excluded.last_seen_at;
end $$;

grant execute on function public.touch_presence() to authenticated;

create or replace function public.user_is_online(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select last_seen_at from public.user_presence where user_id = _user_id) >
      now() - interval '2 minutes',
    false
  );
$$;

grant execute on function public.user_is_online(uuid) to authenticated, anon;

notify pgrst, 'reload schema';
