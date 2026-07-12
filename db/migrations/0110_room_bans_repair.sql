-- Repair room_bans: old table was created without the columns 0049 expects,
-- so the check_room_ban trigger errored with "column expires_at does not exist"
-- on every room_members insert (i.e. anyone joining any room).

drop trigger if exists trg_check_room_ban on public.room_members;
drop table if exists public.room_bans cascade;

create table public.room_bans (
  room_id    uuid not null references public.live_rooms(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  banned_by  uuid references auth.users(id),
  expires_at timestamptz not null,
  reason     text,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index if not exists idx_room_bans_expires on public.room_bans(expires_at);

grant select on public.room_bans to authenticated;
grant all    on public.room_bans to service_role;
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

-- Re-attach the join guard so an active ban blocks re-entry and an expired one auto-clears.
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

create trigger trg_check_room_ban
  before insert on public.room_members
  for each row execute function public.check_room_ban();
