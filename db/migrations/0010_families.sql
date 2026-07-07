-- ============================================================================
-- Jalwa — Families / Teams
-- Every host can run a family (auto-created lazily). Viewers can join.
-- ============================================================================

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  badge text,
  created_at timestamptz not null default now(),
  unique (owner_id)
);

create index if not exists idx_families_owner on public.families(owner_id);

grant select on public.families to anon, authenticated;
grant all on public.families to service_role;

alter table public.families enable row level security;

drop policy if exists "families public read" on public.families;
create policy "families public read"
  on public.families for select using (true);

drop policy if exists "families owner manage" on public.families;
create policy "families owner manage"
  on public.families for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---------- family_members -----------------------------------------------
create table if not exists public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','captain','member')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create index if not exists idx_family_members_user on public.family_members(user_id);

grant select on public.family_members to anon, authenticated;
grant insert, delete on public.family_members to authenticated;
grant all on public.family_members to service_role;

alter table public.family_members enable row level security;

drop policy if exists "family members public read" on public.family_members;
create policy "family members public read"
  on public.family_members for select using (true);

drop policy if exists "family members self join" on public.family_members;
create policy "family members self join"
  on public.family_members for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "family members self leave" on public.family_members;
create policy "family members self leave"
  on public.family_members for delete to authenticated
  using (user_id = auth.uid());

-- ---------- ensure_host_family(host_id) RPC ------------------------------
-- Lazily creates a family record for a host and returns its id.
create or replace function public.ensure_host_family(_host_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  host_name text;
begin
  select id into fid from public.families where owner_id = _host_id;
  if fid is not null then
    return fid;
  end if;

  select coalesce(username, 'Host') into host_name
  from public.profiles where id = _host_id;

  insert into public.families(owner_id, name, badge)
  values (_host_id, host_name || '''s Family', '👑')
  returning id into fid;

  insert into public.family_members(family_id, user_id, role)
  values (fid, _host_id, 'owner')
  on conflict do nothing;

  return fid;
end;
$$;

grant execute on function public.ensure_host_family(uuid) to authenticated;

-- ---------- join_host_family(host_id) RPC --------------------------------
create or replace function public.join_host_family(_host_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'auth required';
  end if;
  fid := public.ensure_host_family(_host_id);
  insert into public.family_members(family_id, user_id, role)
  values (fid, uid, 'member')
  on conflict do nothing;
  return fid;
end;
$$;

grant execute on function public.join_host_family(uuid) to authenticated;
