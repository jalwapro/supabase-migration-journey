-- ============================================================================
-- Jalwa — Phase 1: Foundation (enums, profiles, roles, auth triggers)
-- Run in Supabase Dashboard → SQL Editor → New query → paste → Run
-- ============================================================================

-- ---------- Enums ----------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('user', 'host', 'agent', 'moderator', 'admin', 'super_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pay_method as enum ('jazzcash', 'easypaisa', 'bank_transfer', 'crypto', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.recharge_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- ---------- Shared helper: updated_at trigger ------------------------------
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- gen_user_code (6-digit unique) ---------------------------------
create or replace function public.gen_user_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
  exists_already boolean;
begin
  loop
    candidate := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    select exists (select 1 from public.profiles where user_code = candidate) into exists_already;
    exit when not exists_already;
  end loop;
  return candidate;
end;
$$;

-- ---------- profiles -------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  avatar text,
  frame text,
  bio text,
  gender text,
  country text,
  coins bigint not null default 0,
  diamonds bigint not null default 0,
  level int not null default 1,
  is_vip boolean not null default false,
  vip_expiry timestamptz,
  status text not null default 'active',
  theme_id uuid,
  frame_expires_at timestamptz,
  is_free boolean not null default false,
  user_code text unique,
  last_seen timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.profiles to anon;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

drop policy if exists "profiles are viewable by everyone" on public.profiles;
create policy "profiles are viewable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- ---------- user_roles (SEPARATE table — never on profiles) ---------------
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

drop policy if exists "users can view own roles" on public.user_roles;
create policy "users can view own roles"
  on public.user_roles for select
  to authenticated
  using (auth.uid() = user_id);

-- ---------- has_role / is_admin (SECURITY DEFINER — avoid RLS recursion) --
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('admin', 'super_admin')
  );
$$;

drop policy if exists "admins can view all roles" on public.user_roles;
create policy "admins can view all roles"
  on public.user_roles for select
  to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "admins can manage roles" on public.user_roles;
create policy "admins can manage roles"
  on public.user_roles for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ---------- handle_new_user: auto-create profile + assign default role ----
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  candidate_username text;
  suffix int := 0;
begin
  base_username := split_part(coalesce(new.email, 'user'), '@', 1);
  candidate_username := base_username;

  while exists (select 1 from public.profiles where username = candidate_username) loop
    suffix := suffix + 1;
    candidate_username := base_username || suffix::text;
  end loop;

  insert into public.profiles (id, username, full_name, avatar, user_code)
  values (
    new.id,
    candidate_username,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    public.gen_user_code()
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- grant_admin_for_jalwa (bootstrap super_admin) -----------------
create or replace function public.grant_admin_for_jalwa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email = 'jalwaapplive@gmail.com' and new.email_confirmed_at is not null then
    insert into public.user_roles (user_id, role)
    values (new.id, 'super_admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed_grant_admin on auth.users;
create trigger on_auth_user_confirmed_grant_admin
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.grant_admin_for_jalwa();
