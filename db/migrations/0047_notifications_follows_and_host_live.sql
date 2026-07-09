-- Extend notification fan-out so the whole app produces notifications:
-- 1. New follower -> notify followed user (uses friend_request kind)
-- 2. Host goes live -> notify every follower (host_live kind)
-- 3. Harden notify_user so unrelated trigger errors never block writes.

-- ---------- hardened notify_user (never raise) ----------------------------
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
  -- Skip only if the user has explicitly set this kind to false.
  if exists (
    select 1 from public.notification_prefs
    where user_id = _user_id and (in_app -> _kind::text)::boolean = false
  ) then
    return null;
  end if;
  insert into public.notifications(user_id, kind, title, body, data, actor_id, entity_type, entity_id)
  values (_user_id, _kind, _title, _body, coalesce(_data,'{}'::jsonb), _actor, _entity_type, _entity_id)
  returning id into _id;
  begin
    perform pg_notify('notif_push', json_build_object(
      'id', _id, 'user_id', _user_id, 'kind', _kind,
      'title', _title, 'body', _body, 'data', _data
    )::text);
  exception when others then
    -- ignore pg_notify failures
    null;
  end;
  return _id;
exception when others then
  raise warning 'notify_user skipped: %', SQLERRM;
  return null;
end $$;

grant execute on function public.notify_user(uuid, public.notification_kind, text, text, jsonb, uuid, text, text) to authenticated, service_role;

-- ---------- follows -> friend_request notification ------------------------
create or replace function public.trg_follow_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare _name text;
begin
  if NEW.follower_id is null or NEW.following_id is null
     or NEW.follower_id = NEW.following_id then
    return NEW;
  end if;
  _name := public._notif_display_name(NEW.follower_id);
  perform public.notify_user(
    NEW.following_id,
    'friend_request',
    _name || ' started following you',
    null,
    jsonb_build_object('follower_id', NEW.follower_id),
    NEW.follower_id,
    'follow',
    NEW.follower_id::text
  );
  return NEW;
exception when others then
  raise warning 'trg_follow_notify skipped: %', SQLERRM;
  return NEW;
end $$;

drop trigger if exists trg_follows_notify on public.follows;
create trigger trg_follows_notify
  after insert on public.follows
  for each row execute function public.trg_follow_notify();

-- ---------- host_live: host starts a live room ---------------------------
create or replace function public.trg_live_room_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  _host_name text;
  _title text;
  _became_live boolean := false;
begin
  if TG_OP = 'INSERT' and NEW.status = 'live' then
    _became_live := true;
  elsif TG_OP = 'UPDATE'
    and NEW.status = 'live'
    and (OLD.status is distinct from 'live') then
    _became_live := true;
  end if;

  if not _became_live then
    return NEW;
  end if;

  _host_name := public._notif_display_name(NEW.host_id);
  _title := _host_name || ' is live now';

  insert into public.notifications(user_id, kind, title, body, data, actor_id, entity_type, entity_id)
  select
    f.follower_id,
    'host_live'::public.notification_kind,
    _title,
    NEW.title,
    jsonb_build_object('room_id', NEW.id, 'host_id', NEW.host_id),
    NEW.host_id,
    'room',
    NEW.id::text
  from public.follows f
  where f.following_id = NEW.host_id
    and f.follower_id <> NEW.host_id
    and not exists (
      select 1 from public.notification_prefs np
      where np.user_id = f.follower_id
        and (np.in_app -> 'host_live')::boolean = false
    );

  return NEW;
exception when others then
  raise warning 'trg_live_room_notify skipped: %', SQLERRM;
  return NEW;
end $$;

drop trigger if exists trg_live_rooms_notify on public.live_rooms;
create trigger trg_live_rooms_notify
  after insert or update of status on public.live_rooms
  for each row execute function public.trg_live_room_notify();
