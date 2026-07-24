-- C8: DM privacy/RLS hardening.
--
-- Findings on public.direct_messages:
--
--  1. UPDATE policies "recipient marks state" and "sender soft deletes" only
--     restrict WHICH ROW you can update — they do NOT restrict which columns.
--     A recipient could `update ... set message='fabricated'` on a DM they
--     received; a sender could reassign `recipient_id` or rewrite `media_url`
--     via a soft-delete flow. Real forgery vector.
--  2. "Recipients mark read" and "recipient marks state" are duplicate
--     UPDATE policies with identical predicates. RLS OR's them, but the
--     duplicate creates schema drift and hides intent.
--  3. INSERT policy only checks `sender_id = auth.uid()`. A user blocked by
--     the recipient (public.blocked_users) can still deliver DMs. Blocks
--     must gate DM inserts in both directions.
--  4. sender_id = recipient_id (self-DM) is allowed at the DB level even
--     though the app never does it — cheap CHECK constraint closes it.
--
-- Fix:
--  - Drop the duplicate UPDATE policy.
--  - Replace the two UPDATE policies with column-scoped triggers:
--      * recipient may only touch `read_at`, `delivered_at`
--      * sender may only touch `deleted_at`
--    RLS still gates row access; the trigger enforces column whitelist.
--  - Replace the INSERT policy with one that also rejects blocked pairs
--    (either direction) and self-DMs.
--  - Add a CHECK constraint for self-DMs so bugs can't slip through.

begin;

-- 1. Deduplicate UPDATE policies -------------------------------------------
drop policy if exists "Recipients mark read" on public.direct_messages;
drop policy if exists "recipient marks state" on public.direct_messages;
drop policy if exists "sender soft deletes" on public.direct_messages;

create policy "dm recipient updates state"
  on public.direct_messages for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy "dm sender updates state"
  on public.direct_messages for update to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

-- 2. Column whitelist trigger ----------------------------------------------
create or replace function public.dm_guard_updates()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  is_admin_caller boolean := coalesce(public.is_admin(me), false);
begin
  -- Admins bypass (support/moderation tools).
  if is_admin_caller then return new; end if;

  -- Immutable identity/content fields for EVERY non-admin update.
  if new.id             is distinct from old.id             then raise exception 'dm: id is immutable';         end if;
  if new.sender_id      is distinct from old.sender_id      then raise exception 'dm: sender_id is immutable';  end if;
  if new.recipient_id   is distinct from old.recipient_id   then raise exception 'dm: recipient_id is immutable'; end if;
  if new.created_at     is distinct from old.created_at     then raise exception 'dm: created_at is immutable'; end if;
  if new.kind           is distinct from old.kind           then raise exception 'dm: kind is immutable';       end if;
  if new.message        is distinct from old.message        then raise exception 'dm: message is immutable';    end if;
  if new.media_url      is distinct from old.media_url      then raise exception 'dm: media_url is immutable';  end if;
  if new.media_mime     is distinct from old.media_mime     then raise exception 'dm: media_mime is immutable'; end if;
  if new.duration_seconds is distinct from old.duration_seconds then raise exception 'dm: duration_seconds is immutable'; end if;
  if new.gallery_image_id is distinct from old.gallery_image_id then raise exception 'dm: gallery_image_id is immutable'; end if;
  if new.reply_to_id    is distinct from old.reply_to_id    then raise exception 'dm: reply_to_id is immutable'; end if;

  -- Column whitelist per role.
  if me = old.recipient_id then
    -- Recipient may only mark delivery/read state.
    if new.deleted_at is distinct from old.deleted_at then
      raise exception 'dm: only the sender can soft-delete';
    end if;
  elsif me = old.sender_id then
    -- Sender may only soft-delete their own message.
    if new.read_at is distinct from old.read_at
       or new.delivered_at is distinct from old.delivered_at then
      raise exception 'dm: only the recipient can mark read/delivered';
    end if;
  else
    raise exception 'dm: not a participant';
  end if;

  return new;
end $$;

drop trigger if exists trg_dm_guard_updates on public.direct_messages;
create trigger trg_dm_guard_updates
  before update on public.direct_messages
  for each row execute function public.dm_guard_updates();

-- 3. Block-aware INSERT policy ---------------------------------------------
drop policy if exists "Users send messages" on public.direct_messages;

create policy "dm sender inserts allowed pair"
  on public.direct_messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    and sender_id <> recipient_id
    and not exists (
      select 1 from public.blocked_users b
       where (b.blocker_id = recipient_id and b.blocked_id = sender_id)
          or (b.blocker_id = sender_id    and b.blocked_id = recipient_id)
    )
  );

-- 4. Self-DM guard rail ----------------------------------------------------
alter table public.direct_messages
  drop constraint if exists direct_messages_no_self_dm;
alter table public.direct_messages
  add constraint direct_messages_no_self_dm check (sender_id <> recipient_id) not valid;
-- `not valid` skips the historical scan (there should be none, but this keeps
-- the migration cheap and non-blocking on large tables). Future rows are
-- validated.

commit;
