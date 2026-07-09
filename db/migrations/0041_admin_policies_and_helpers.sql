-- ============================================================================
-- 0041 — Admin governance repair
-- 1. live_rooms: admins can force-end and delete any room (P0)
-- 2. profiles:   admins can update any profile (status, coins, bans) (P0)
-- 3. adjust_coins RPC — atomic, admin-only, safe against race conditions (P2)
-- All idempotent.
-- ============================================================================

-- ---------- live_rooms: admin overrides ------------------------------------
drop policy if exists "admins update any live_room" on public.live_rooms;
create policy "admins update any live_room"
  on public.live_rooms for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "admins delete any live_room" on public.live_rooms;
create policy "admins delete any live_room"
  on public.live_rooms for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- ---------- profiles: admin overrides --------------------------------------
drop policy if exists "admins update any profile" on public.profiles;
create policy "admins update any profile"
  on public.profiles for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ---------- adjust_coins RPC (atomic) --------------------------------------
create or replace function public.adjust_coins(_user_id uuid, _delta bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  new_balance bigint;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not public.is_admin(me) then raise exception 'admin only'; end if;

  update public.profiles
     set coins = greatest(0, coalesce(coins, 0) + _delta)
   where id = _user_id
   returning coins into new_balance;

  if not found then raise exception 'user not found'; end if;

  insert into public.admin_logs (admin_id, action, target, details)
    values (me, 'adjust_coins', _user_id::text,
            jsonb_build_object('delta', _delta, 'new_balance', new_balance));

  return new_balance;
end $$;

grant execute on function public.adjust_coins(uuid, bigint) to authenticated;

notify pgrst, 'reload schema';
