-- Profile view tracking for visitor profile card.
create table if not exists public.profile_views (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique (owner_id, viewer_id)
);

grant select, insert, update on public.profile_views to authenticated;
grant all on public.profile_views to service_role;

alter table public.profile_views enable row level security;

drop policy if exists "owner can read own views" on public.profile_views;
create policy "owner can read own views"
  on public.profile_views for select
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "viewer can upsert own view" on public.profile_views;
create policy "viewer can upsert own view"
  on public.profile_views for insert
  to authenticated
  with check (auth.uid() = viewer_id and viewer_id <> owner_id);

drop policy if exists "viewer can refresh own view" on public.profile_views;
create policy "viewer can refresh own view"
  on public.profile_views for update
  to authenticated
  using (auth.uid() = viewer_id)
  with check (auth.uid() = viewer_id);

create index if not exists idx_profile_views_owner on public.profile_views(owner_id, viewed_at desc);

-- Upsert helper called from client on profile open.
create or replace function public.record_profile_view(_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() = _owner then
    return;
  end if;
  insert into public.profile_views(owner_id, viewer_id, viewed_at)
  values (_owner, auth.uid(), now())
  on conflict (owner_id, viewer_id)
  do update set viewed_at = excluded.viewed_at;
end;
$$;

grant execute on function public.record_profile_view(uuid) to authenticated;
