-- 0090_chat_whatsapp_features.sql
-- WhatsApp-style extras for direct_messages:
--   * delivered_at  → double-tick when recipient's client has received it
--   * reply_to_id   → quote/reply support
--   * deleted_at    → "delete for everyone" soft delete
-- Also indexes + realtime already covers direct_messages.

alter table public.direct_messages
  add column if not exists delivered_at timestamptz,
  add column if not exists reply_to_id  uuid references public.direct_messages(id) on delete set null,
  add column if not exists deleted_at   timestamptz;

create index if not exists idx_dm_reply_to on public.direct_messages(reply_to_id);
create index if not exists idx_dm_recv_delivered
  on public.direct_messages(recipient_id, delivered_at)
  where delivered_at is null;

-- Broaden UPDATE policy so recipient can set delivered_at as well as read_at,
-- and sender can set deleted_at on their own messages.
drop policy if exists "receiver marks read"      on public.direct_messages;
drop policy if exists "recipient marks state"    on public.direct_messages;
drop policy if exists "sender soft deletes"      on public.direct_messages;

create policy "recipient marks state"
  on public.direct_messages for update to authenticated
  using  (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy "sender soft deletes"
  on public.direct_messages for update to authenticated
  using  (sender_id = auth.uid())
  with check (sender_id = auth.uid());

-- Helper: heartbeat RPC so any authed client can touch last_seen without
-- needing an UPDATE policy on the whole profiles row.
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set last_seen = now()
   where id = auth.uid();
$$;

grant execute on function public.touch_last_seen() to authenticated;
