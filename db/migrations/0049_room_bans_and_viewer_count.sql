-- Room bans (kick with cooldown) + viewer_count maintenance
-- ------------------------------------------------------------------

-- ---------- room_bans -----------------------------------------------------
create table if not exists public.room_bans (
  room_id   uuid not null references public.live_rooms(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  banned_by uuid references auth.users(id),
  expires_at timestamptz not null,
  reason    text,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index if not exists idx_room_bans_expires on public.room_bans(expires_at);

grant select on public.room_bans to authenticated;
grant all on public.room_bans to service_role;
alter table public.room_bans enable row level security;

drop policy if exists "room_bans read" on public.room_bans;
create policy "room_bans read"
  on public.room_bans for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.live_rooms r where r.id = room_bans.room_id and r.host_id = auth.uid())
    or exists (
      select 1 from public.room_members m
       where m.room_id = room_bans.room_id and m.user_id = auth.uid() and m.is_moderator
    )
  );

-- ---------- block joining if actively banned -----------------------------
create or replace function public.check_room_ban() returns trigger
language plpgsql security definer set search_path = public as $$
declare exp timestamptz;
begin
  select expires_at into exp
    from public.room_bans
   where room_id = new.room_id and user_id = new.user_id;
  if exp is not null then
    if exp > now() then
      raise exception 'BANNED: You were removed from this room. Try again after %',
        to_char(exp at time zone 'UTC', 'HH24:MI" UTC"');
    else
      delete from public.room_bans
        where room_id = new.room_id and user_id = new.user_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_check_room_ban on public.room_members;
create trigger trg_check_room_ban
  before insert on public.room_members
  for each row execute function public.check_room_ban();

-- ---------- kick_from_room RPC -------------------------------------------
create or replace function public.kick_from_room(
  _room_id uuid,
  _user_id uuid,
  _minutes int default 30
) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  is_host boolean;
  is_mod  boolean;
  target_is_host boolean;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select (host_id = me) into is_host from public.live_rooms where id = _room_id;
  select exists(
    select 1 from public.room_members
     where room_id = _room_id and user_id = me and is_moderator
  ) into is_mod;

  if not coalesce(is_host, false) and not is_mod then
    raise exception 'only host or moderator can kick';
  end if;

  select (host_id = _user_id) into target_is_host
    from public.live_rooms where id = _room_id;
  if coalesce(target_is_host, false) then
    raise exception 'cannot kick the host';
  end if;

  delete from public.room_members
    where room_id = _room_id and user_id = _user_id;

  insert into public.room_bans (room_id, user_id, banned_by, expires_at)
    values (_room_id, _user_id, me, now() + make_interval(mins => greatest(_minutes, 1)))
  on conflict (room_id, user_id) do update
    set expires_at = excluded.expires_at,
        banned_by  = excluded.banned_by,
        created_at = now();
end $$;

grant execute on function public.kick_from_room(uuid, uuid, int) to authenticated;

-- ---------- viewer_count maintenance --------------------------------------
create or replace function public.trg_room_members_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.live_rooms
       set viewer_count = viewer_count + 1
     where id = new.room_id;
  elsif (tg_op = 'DELETE') then
    update public.live_rooms
       set viewer_count = greatest(viewer_count - 1, 0)
     where id = old.room_id;
  end if;
  return null;
end $$;

drop trigger if exists trg_room_members_count_ins on public.room_members;
create trigger trg_room_members_count_ins
  after insert on public.room_members
  for each row execute function public.trg_room_members_count();

drop trigger if exists trg_room_members_count_del on public.room_members;
create trigger trg_room_members_count_del
  after delete on public.room_members
  for each row execute function public.trg_room_members_count();

-- backfill counts from current membership
update public.live_rooms r
   set viewer_count = coalesce(
     (select count(*) from public.room_members m where m.room_id = r.id), 0);
