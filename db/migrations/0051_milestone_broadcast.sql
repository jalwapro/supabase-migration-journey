-- ============================================================================
-- Jalwa — global milestone broadcast
--   When a room hits 100% popularity and the host awards the milestone gift,
--   every open room shows an announcement "<host> ka popularity task complete
--   ho gaya". Backed by a lightweight broadcast table + realtime.
-- ============================================================================

create table if not exists public.milestone_broadcasts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  host_id uuid not null references auth.users(id) on delete cascade,
  host_username text,
  host_avatar text,
  room_title text,
  created_at timestamptz not null default now()
);

create index if not exists idx_milestone_broadcasts_created
  on public.milestone_broadcasts (created_at desc);

grant select on public.milestone_broadcasts to anon, authenticated;
grant all on public.milestone_broadcasts to service_role;

alter table public.milestone_broadcasts enable row level security;

drop policy if exists "milestone broadcasts public read" on public.milestone_broadcasts;
create policy "milestone broadcasts public read"
  on public.milestone_broadcasts for select using (true);

-- Trigger: when live_rooms.milestone_awarded_at transitions from NULL → NOT NULL,
-- publish a broadcast row so every live client can react.
create or replace function public.tg_publish_milestone_broadcast()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hp record;
begin
  if (old.milestone_awarded_at is null) and (new.milestone_awarded_at is not null) then
    select username, avatar into hp from public.profiles where id = new.host_id;
    insert into public.milestone_broadcasts(room_id, host_id, host_username, host_avatar, room_title)
    values (new.id, new.host_id, hp.username, hp.avatar, new.title);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_publish_milestone_broadcast on public.live_rooms;
create trigger trg_publish_milestone_broadcast
  after update of milestone_awarded_at on public.live_rooms
  for each row execute function public.tg_publish_milestone_broadcast();

-- Add to realtime publication (idempotent).
do $$ begin
  alter publication supabase_realtime add table public.milestone_broadcasts;
exception when duplicate_object then null; when others then null; end $$;
