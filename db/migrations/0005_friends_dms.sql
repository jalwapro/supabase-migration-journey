-- ============================================================================
-- Jalwa — Phase 6: Friends + Direct Messages
-- ============================================================================

do $$ begin
  create type public.friend_status as enum ('pending','accepted','blocked');
exception when duplicate_object then null; end $$;

-- ---------- friendships ---------------------------------------------------
-- Requester → addressee. Symmetric read; only accepted pairs can DM.
create table if not exists public.friendships (
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status public.friend_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index if not exists idx_friend_addressee on public.friendships(addressee_id, status);
create index if not exists idx_friend_requester on public.friendships(requester_id, status);

grant select, insert, update, delete on public.friendships to authenticated;
grant all on public.friendships to service_role;

alter table public.friendships enable row level security;

drop policy if exists "user reads own friendships" on public.friendships;
create policy "user reads own friendships"
  on public.friendships for select to authenticated
  using (auth.uid() in (requester_id, addressee_id));

drop policy if exists "user creates own request" on public.friendships;
create policy "user creates own request"
  on public.friendships for insert to authenticated
  with check (auth.uid() = requester_id and status = 'pending');

drop policy if exists "addressee updates request" on public.friendships;
create policy "addressee updates request"
  on public.friendships for update to authenticated
  using (auth.uid() in (requester_id, addressee_id))
  with check (auth.uid() in (requester_id, addressee_id));

drop policy if exists "either party removes" on public.friendships;
create policy "either party removes"
  on public.friendships for delete to authenticated
  using (auth.uid() in (requester_id, addressee_id));

drop trigger if exists trg_friendships_updated_at on public.friendships;
create trigger trg_friendships_updated_at
  before update on public.friendships
  for each row execute function public.update_updated_at_column();

-- ---------- friends helper (returns "am I friends?" boolean) --------------
create or replace function public.are_friends(_a uuid, _b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = _a and addressee_id = _b)
        or (requester_id = _b and addressee_id = _a))
  );
$$;

grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- ---------- direct_messages ----------------------------------------------
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

create index if not exists idx_dm_pair on public.direct_messages(
  least(sender_id, receiver_id), greatest(sender_id, receiver_id), created_at desc
);
create index if not exists idx_dm_recv_unread on public.direct_messages(receiver_id, read_at);

grant select, insert, update on public.direct_messages to authenticated;
grant all on public.direct_messages to service_role;

alter table public.direct_messages enable row level security;

drop policy if exists "user reads own dms" on public.direct_messages;
create policy "user reads own dms"
  on public.direct_messages for select to authenticated
  using (auth.uid() in (sender_id, receiver_id));

drop policy if exists "friends can send dm" on public.direct_messages;
create policy "friends can send dm"
  on public.direct_messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    and public.are_friends(sender_id, receiver_id)
  );

drop policy if exists "receiver marks read" on public.direct_messages;
create policy "receiver marks read"
  on public.direct_messages for update to authenticated
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

-- Realtime publication
alter publication supabase_realtime add table public.direct_messages;
alter publication supabase_realtime add table public.friendships;
