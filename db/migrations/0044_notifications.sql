-- ============================================================================
-- Jalwa — Phase A: Notifications system
-- In-app notifications feed + per-user channel prefs + push subscriptions
-- + fan-out triggers for social/room/economy/admin events.
-- ============================================================================

-- ---------- enum -----------------------------------------------------------
do $$ begin
  create type public.notification_kind as enum (
    -- social
    'friend_request','friend_accept','dm_new','mention',
    -- room
    'host_live','seat_invite','mod_added','kicked',
    -- economy
    'gift_received','recharge_approved','recharge_rejected',
    'withdrawal_approved','withdrawal_rejected','vip_expiring','vip_expired',
    -- admin / system
    'system_broadcast','account_warning','account_action'
  );
exception when duplicate_object then null; end $$;

-- ---------- notifications --------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.notification_kind not null,
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notif_user_created on public.notifications(user_id, created_at desc);
create index if not exists idx_notif_user_unread on public.notifications(user_id, read_at) where read_at is null;

grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;

alter table public.notifications enable row level security;

drop policy if exists "user reads own notifs" on public.notifications;
create policy "user reads own notifs"
  on public.notifications for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user updates own notifs" on public.notifications;
create policy "user updates own notifs"
  on public.notifications for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user deletes own notifs" on public.notifications;
create policy "user deletes own notifs"
  on public.notifications for delete to authenticated
  using (auth.uid() = user_id);

-- Realtime
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;

-- ---------- notification_prefs --------------------------------------------
create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app jsonb not null default '{}'::jsonb,   -- { kind: bool } overrides
  push   jsonb not null default '{}'::jsonb,
  email  jsonb not null default '{}'::jsonb,
  push_enabled boolean not null default true,
  email_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.notification_prefs to authenticated;
grant all on public.notification_prefs to service_role;

alter table public.notification_prefs enable row level security;

drop policy if exists "user reads own prefs" on public.notification_prefs;
create policy "user reads own prefs"
  on public.notification_prefs for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user upserts own prefs" on public.notification_prefs;
create policy "user upserts own prefs"
  on public.notification_prefs for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user updates own prefs" on public.notification_prefs;
create policy "user updates own prefs"
  on public.notification_prefs for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- push_subscriptions --------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('web','android','ios')),
  endpoint text,          -- Web Push endpoint
  p256dh text,
  auth text,
  fcm_token text,         -- Native FCM/APNs token
  user_agent text,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists uq_push_web on public.push_subscriptions(user_id, endpoint) where endpoint is not null;
create unique index if not exists uq_push_fcm on public.push_subscriptions(user_id, fcm_token) where fcm_token is not null;
create index if not exists idx_push_user on public.push_subscriptions(user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

alter table public.push_subscriptions enable row level security;

drop policy if exists "user manages own push subs" on public.push_subscriptions;
create policy "user manages own push subs"
  on public.push_subscriptions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- helper: insert notification ------------------------------------
create or replace function public.notify_user(
  _user_id uuid, _kind public.notification_kind, _title text,
  _body text default null, _data jsonb default '{}'::jsonb,
  _actor uuid default null, _entity_type text default null, _entity_id text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare _id uuid;
begin
  if _user_id is null then return null; end if;
  -- Skip if user disabled this kind in-app
  if exists (
    select 1 from public.notification_prefs
    where user_id = _user_id and (in_app -> _kind::text)::boolean = false
  ) then
    return null;
  end if;
  insert into public.notifications(user_id, kind, title, body, data, actor_id, entity_type, entity_id)
  values (_user_id, _kind, _title, _body, coalesce(_data,'{}'::jsonb), _actor, _entity_type, _entity_id)
  returning id into _id;
  perform pg_notify('notif_push', json_build_object(
    'id', _id, 'user_id', _user_id, 'kind', _kind, 'title', _title, 'body', _body, 'data', _data
  )::text);
  return _id;
end $$;

grant execute on function public.notify_user(uuid, public.notification_kind, text, text, jsonb, uuid, text, text) to authenticated, service_role;

-- ---------- helpers to look up display name --------------------------------
create or replace function public._notif_display_name(_uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(username,''), nullif(full_name,''), 'Someone')
  from public.profiles where id = _uid;
$$;

-- ============================================================================
-- Triggers per event
-- ============================================================================

-- ---------- friendships ----------------------------------------------------
create or replace function public.trg_friendship_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare _name text;
begin
  if TG_OP = 'INSERT' and NEW.status = 'pending' then
    _name := public._notif_display_name(NEW.requester_id);
    perform public.notify_user(
      NEW.addressee_id, 'friend_request',
      _name || ' sent you a friend request',
      null,
      jsonb_build_object('requester_id', NEW.requester_id),
      NEW.requester_id, 'friendship', NEW.requester_id::text
    );
  elsif TG_OP = 'UPDATE' and NEW.status = 'accepted' and OLD.status <> 'accepted' then
    _name := public._notif_display_name(NEW.addressee_id);
    perform public.notify_user(
      NEW.requester_id, 'friend_accept',
      _name || ' accepted your friend request',
      null,
      jsonb_build_object('friend_id', NEW.addressee_id),
      NEW.addressee_id, 'friendship', NEW.addressee_id::text
    );
  end if;
  return NEW;
end $$;

drop trigger if exists trg_friendships_notify on public.friendships;
create trigger trg_friendships_notify
  after insert or update on public.friendships
  for each row execute function public.trg_friendship_notify();

-- ---------- direct messages -----------------------------------------------
create or replace function public.trg_dm_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare _name text;
begin
  _name := public._notif_display_name(NEW.sender_id);
  perform public.notify_user(
    NEW.receiver_id, 'dm_new',
    _name || ' sent you a message',
    left(NEW.text, 120),
    jsonb_build_object('sender_id', NEW.sender_id, 'message_id', NEW.id),
    NEW.sender_id, 'dm', NEW.id::text
  );
  return NEW;
end $$;

drop trigger if exists trg_dm_notify on public.direct_messages;
create trigger trg_dm_notify
  after insert on public.direct_messages
  for each row execute function public.trg_dm_notify();

-- ---------- gifts (best-effort — table columns vary; guard with EXCEPTION) --
do $$ begin
  if to_regclass('public.gift_events') is not null then
    create or replace function public.trg_gift_notify() returns trigger
    language plpgsql security definer set search_path = public as $BODY$
    declare _sender text; _recipient uuid;
    begin
      -- try common column names
      begin _recipient := NEW.recipient_id; exception when others then
        begin _recipient := NEW.receiver_id; exception when others then
          begin _recipient := NEW.host_id; exception when others then _recipient := null; end;
        end;
      end;
      if _recipient is null then return NEW; end if;
      _sender := public._notif_display_name(NEW.sender_id);
      perform public.notify_user(
        _recipient, 'gift_received',
        _sender || ' sent you a gift',
        null,
        to_jsonb(NEW),
        NEW.sender_id, 'gift', NEW.id::text
      );
      return NEW;
    end $BODY$;

    drop trigger if exists trg_gifts_notify on public.gift_events;
    create trigger trg_gifts_notify
      after insert on public.gift_events
      for each row execute function public.trg_gift_notify();
  end if;
end $$;

-- ---------- recharge status ------------------------------------------------
do $$ begin
  if to_regclass('public.recharge_requests') is not null then
    create or replace function public.trg_recharge_notify() returns trigger
    language plpgsql security definer set search_path = public as $BODY$
    begin
      if TG_OP = 'UPDATE' and NEW.status is distinct from OLD.status then
        if NEW.status = 'approved' then
          perform public.notify_user(
            NEW.user_id, 'recharge_approved',
            'Recharge approved',
            'Your recharge has been credited to your wallet.',
            jsonb_build_object('request_id', NEW.id, 'amount', NEW.amount),
            null, 'recharge', NEW.id::text
          );
        elsif NEW.status = 'rejected' then
          perform public.notify_user(
            NEW.user_id, 'recharge_rejected',
            'Recharge rejected',
            'Your recharge was not approved. Contact support if this is a mistake.',
            jsonb_build_object('request_id', NEW.id),
            null, 'recharge', NEW.id::text
          );
        end if;
      end if;
      return NEW;
    end $BODY$;

    drop trigger if exists trg_recharge_notify on public.recharge_requests;
    create trigger trg_recharge_notify
      after update on public.recharge_requests
      for each row execute function public.trg_recharge_notify();
  end if;
end $$;

-- ---------- withdrawal status ---------------------------------------------
do $$ begin
  if to_regclass('public.withdrawal_requests') is not null then
    create or replace function public.trg_withdrawal_notify() returns trigger
    language plpgsql security definer set search_path = public as $BODY$
    begin
      if TG_OP = 'UPDATE' and NEW.status is distinct from OLD.status then
        if NEW.status = 'approved' or NEW.status = 'paid' then
          perform public.notify_user(
            NEW.user_id, 'withdrawal_approved',
            'Withdrawal approved',
            'Your withdrawal request has been processed.',
            jsonb_build_object('request_id', NEW.id),
            null, 'withdrawal', NEW.id::text
          );
        elsif NEW.status = 'rejected' then
          perform public.notify_user(
            NEW.user_id, 'withdrawal_rejected',
            'Withdrawal rejected',
            'Your withdrawal was not approved.',
            jsonb_build_object('request_id', NEW.id),
            null, 'withdrawal', NEW.id::text
          );
        end if;
      end if;
      return NEW;
    end $BODY$;

    drop trigger if exists trg_withdrawal_notify on public.withdrawal_requests;
    create trigger trg_withdrawal_notify
      after update on public.withdrawal_requests
      for each row execute function public.trg_withdrawal_notify();
  end if;
end $$;

-- ---------- seat invites ---------------------------------------------------
do $$ begin
  if to_regclass('public.seat_invites') is not null then
    create or replace function public.trg_seat_invite_notify() returns trigger
    language plpgsql security definer set search_path = public as $BODY$
    declare _host text;
    begin
      _host := public._notif_display_name(NEW.inviter_id);
      perform public.notify_user(
        NEW.invitee_id, 'seat_invite',
        _host || ' invited you to a seat',
        null,
        jsonb_build_object('room_id', NEW.room_id, 'seat_index', NEW.seat_index),
        NEW.inviter_id, 'room', NEW.room_id::text
      );
      return NEW;
    end $BODY$;

    drop trigger if exists trg_seat_invite_notify on public.seat_invites;
    create trigger trg_seat_invite_notify
      after insert on public.seat_invites
      for each row execute function public.trg_seat_invite_notify();
  end if;
end $$;

-- ---------- room moderators ------------------------------------------------
do $$ begin
  if to_regclass('public.room_moderators') is not null then
    create or replace function public.trg_room_mod_notify() returns trigger
    language plpgsql security definer set search_path = public as $BODY$
    begin
      perform public.notify_user(
        NEW.user_id, 'mod_added',
        'You are now a room moderator',
        null,
        jsonb_build_object('room_id', NEW.room_id),
        null, 'room', NEW.room_id::text
      );
      return NEW;
    end $BODY$;

    drop trigger if exists trg_room_mod_notify on public.room_moderators;
    create trigger trg_room_mod_notify
      after insert on public.room_moderators
      for each row execute function public.trg_room_mod_notify();
  end if;
end $$;

-- ---------- admin broadcast RPC -------------------------------------------
create or replace function public.send_broadcast(
  _title text, _body text, _target text default 'all'
) returns int
language plpgsql security definer set search_path = public
as $$
declare _count int := 0;
begin
  if not public.has_role(auth.uid(), 'admin')
     and not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'admins only';
  end if;
  if _target = 'vip' then
    insert into public.notifications(user_id, kind, title, body)
    select id, 'system_broadcast', _title, _body from public.profiles where is_vip = true;
  elsif _target = 'hosts' then
    insert into public.notifications(user_id, kind, title, body)
    select ur.user_id, 'system_broadcast', _title, _body
    from public.user_roles ur where ur.role = 'host';
  else
    insert into public.notifications(user_id, kind, title, body)
    select id, 'system_broadcast', _title, _body from public.profiles;
  end if;
  get diagnostics _count = row_count;
  return _count;
end $$;

grant execute on function public.send_broadcast(text, text, text) to authenticated;

-- ---------- utility: unread count -----------------------------------------
create or replace function public.notif_unread_count() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.notifications
  where user_id = auth.uid() and read_at is null;
$$;

grant execute on function public.notif_unread_count() to authenticated;

-- ---------- utility: mark all read ----------------------------------------
create or replace function public.notif_mark_all_read() returns int
language plpgsql security definer set search_path = public as $$
declare _n int;
begin
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null;
  get diagnostics _n = row_count;
  return _n;
end $$;

grant execute on function public.notif_mark_all_read() to authenticated;
