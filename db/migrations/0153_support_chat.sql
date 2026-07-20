-- ============================================================================
-- 0153 — Live customer-support chat
-- Users chat 1:1 with any signed-in support agent (role = 'agent' or 'admin').
-- Kept intentionally simple: one conversation row per user, message stream.
-- ============================================================================

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  assigned_agent uuid references auth.users(id) on delete set null,
  status text not null default 'open' check (status in ('open','closed')),
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  unread_for_user integer not null default 0,
  unread_for_agent integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists support_conv_status_idx
  on public.support_conversations (status, last_message_at desc);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_kind text not null check (sender_kind in ('user','agent')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_msg_conv_idx
  on public.support_messages (conversation_id, created_at);

-- GRANTS --------------------------------------------------------------------
grant select, insert, update on public.support_conversations to authenticated;
grant select, insert on public.support_messages to authenticated;
grant all on public.support_conversations, public.support_messages to service_role;

alter table public.support_conversations enable row level security;
alter table public.support_messages      enable row level security;

-- Helper: is caller a support agent? (agent role OR admin)
create or replace function public.is_support_agent(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(_uid, 'agent'::public.app_role)
      or public.has_role(_uid, 'admin'::public.app_role)
      or public.has_role(_uid, 'super_admin'::public.app_role);
$$;
grant execute on function public.is_support_agent(uuid) to authenticated;

-- Conversations policies ----------------------------------------------------
drop policy if exists "conv owner read"   on public.support_conversations;
drop policy if exists "conv agent read"   on public.support_conversations;
drop policy if exists "conv owner upsert" on public.support_conversations;
drop policy if exists "conv agent update" on public.support_conversations;

create policy "conv owner read"
  on public.support_conversations for select to authenticated
  using (user_id = auth.uid());

create policy "conv agent read"
  on public.support_conversations for select to authenticated
  using (public.is_support_agent(auth.uid()));

create policy "conv owner upsert"
  on public.support_conversations for insert to authenticated
  with check (user_id = auth.uid());

create policy "conv agent update"
  on public.support_conversations for update to authenticated
  using (public.is_support_agent(auth.uid()) or user_id = auth.uid())
  with check (public.is_support_agent(auth.uid()) or user_id = auth.uid());

-- Messages policies ---------------------------------------------------------
drop policy if exists "msg owner read"   on public.support_messages;
drop policy if exists "msg agent read"   on public.support_messages;
drop policy if exists "msg owner insert" on public.support_messages;
drop policy if exists "msg agent insert" on public.support_messages;

create policy "msg owner read"
  on public.support_messages for select to authenticated
  using (exists (select 1 from public.support_conversations c
                  where c.id = conversation_id and c.user_id = auth.uid()));

create policy "msg agent read"
  on public.support_messages for select to authenticated
  using (public.is_support_agent(auth.uid()));

create policy "msg owner insert"
  on public.support_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and sender_kind = 'user'
    and exists (select 1 from public.support_conversations c
                 where c.id = conversation_id and c.user_id = auth.uid())
  );

create policy "msg agent insert"
  on public.support_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and sender_kind = 'agent'
    and public.is_support_agent(auth.uid())
  );

-- Trigger: update conversation summary on new message -----------------------
create or replace function public._support_after_msg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_conversations
     set last_message_at = new.created_at,
         last_message_preview = left(new.body, 140),
         status = 'open',
         unread_for_user  = case when new.sender_kind = 'agent' then unread_for_user + 1 else 0 end,
         unread_for_agent = case when new.sender_kind = 'user'  then unread_for_agent + 1 else 0 end
   where id = new.conversation_id;
  return new;
end $$;

drop trigger if exists trg_support_after_msg on public.support_messages;
create trigger trg_support_after_msg
  after insert on public.support_messages
  for each row execute function public._support_after_msg();

-- RPC: get-or-create the caller's conversation
create or replace function public.get_or_create_support_conversation()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  cid uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select id into cid from public.support_conversations where user_id = me;
  if cid is null then
    insert into public.support_conversations(user_id) values (me) returning id into cid;
  end if;
  return cid;
end $$;
grant execute on function public.get_or_create_support_conversation() to authenticated;

-- Realtime
alter publication supabase_realtime add table public.support_messages;
alter publication supabase_realtime add table public.support_conversations;

notify pgrst, 'reload schema';
