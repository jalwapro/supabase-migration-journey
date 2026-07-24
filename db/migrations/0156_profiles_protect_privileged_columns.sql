-- 0156: Lock down profiles UPDATE so users cannot self-mint coins, VIP, level, etc.
--
-- Problem (C1): profiles UPDATE policy is USING (auth.uid()=id) with the same
-- WITH CHECK, so a signed-in user can update ANY column on their own row from
-- the browser console — including coins, diamonds, is_vip, vip_tier, level, xp,
-- is_free, total_gifted_coins, status, user_code. That's a full economy bypass.
--
-- Fix: keep the RLS policies (row ownership) but add a BEFORE UPDATE trigger
-- that reverts privileged columns to their OLD value whenever the caller is
-- not an admin. Admins (is_admin(auth.uid())) and SECURITY DEFINER RPCs
-- (auth.uid() is null in service_role context) can still change everything.
--
-- Also cleans up duplicate policies on profiles and user_roles.

begin;

-- ---------------------------------------------------------------------------
-- 1. Drop duplicate policies (leftovers from earlier migrations)
-- ---------------------------------------------------------------------------
drop policy if exists "users can update own profile" on public.profiles;
drop policy if exists "profiles are viewable by everyone" on public.profiles;

drop policy if exists "users can view own roles"  on public.user_roles;
drop policy if exists "admins can view all roles" on public.user_roles;
drop policy if exists "admins can manage roles"   on public.user_roles;

-- gifts had two identical admin-manage policies
drop policy if exists "admins manage gifts" on public.gifts;

-- ---------------------------------------------------------------------------
-- 2. Column-protection trigger
-- ---------------------------------------------------------------------------
create or replace function public.profiles_guard_protected_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin_caller boolean;
begin
  -- SECURITY DEFINER RPCs / service_role: auth.uid() is null → allow.
  if auth.uid() is null then
    return new;
  end if;

  is_admin_caller := public.is_admin(auth.uid());
  if is_admin_caller then
    return new;
  end if;

  -- Non-admin user: revert every privileged column back to its OLD value.
  -- Whitelist of user-editable columns (everything else is locked):
  --   username, full_name, avatar, bio, gender, country,
  --   frame, theme_id, ring, bubble, car, entrance, data_card,
  --   updated_at, last_seen
  new.id                 := old.id;
  new.coins              := old.coins;
  new.diamonds           := old.diamonds;
  new.is_vip             := old.is_vip;
  new.vip_expiry         := old.vip_expiry;
  new.vip_tier           := old.vip_tier;
  new.vip_title          := old.vip_title;
  new.vip_level          := old.vip_level;
  new.vip_updated_at     := old.vip_updated_at;
  new.level              := old.level;
  new.xp                 := old.xp;
  new.is_free            := old.is_free;
  new.total_gifted_coins := old.total_gifted_coins;
  new.status             := old.status;
  new.user_code          := old.user_code;
  new.frame_expires_at   := old.frame_expires_at;
  new.special_id         := old.special_id;
  new.created_at         := old.created_at;

  return new;
end;
$$;

drop trigger if exists profiles_guard_protected_columns on public.profiles;
create trigger profiles_guard_protected_columns
before update on public.profiles
for each row
execute function public.profiles_guard_protected_columns();

commit;
