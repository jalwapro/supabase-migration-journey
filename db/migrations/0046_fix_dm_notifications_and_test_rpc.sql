-- Fix chat + notification issues caused by schema drift:
-- - direct_messages uses recipient_id/message in the live app, but the 0044
--   notification trigger referenced receiver_id/text.
-- - harden DM notification trigger so it never blocks chat inserts again.
-- - add a safe RPC for the settings-page test notification button.

-- Keep gift notification repair idempotent in case 0045 was not run yet.
drop trigger if exists trg_gifts_notify on public.gift_events;
drop function if exists public.trg_gift_notify();

do $$
begin
  if to_regclass('public.direct_messages') is not null then
    create or replace function public.trg_dm_notify() returns trigger
    language plpgsql security definer set search_path = public as $BODY$
    declare
      _row jsonb;
      _sender uuid;
      _recipient uuid;
      _kind text;
      _body text;
      _name text;
      _message_id text;
    begin
      _row := to_jsonb(NEW);
      _sender := nullif(_row ->> 'sender_id', '')::uuid;
      _recipient := nullif(coalesce(_row ->> 'recipient_id', _row ->> 'receiver_id'), '')::uuid;
      _kind := coalesce(nullif(_row ->> 'kind', ''), 'text');
      _message_id := _row ->> 'id';

      if _sender is null or _recipient is null or _sender = _recipient then
        return NEW;
      end if;

      _body := case _kind
        when 'image' then '📷 Photo'
        when 'video' then '🎬 Video'
        when 'voice' then '🎙️ Voice message'
        when 'album' then '🖼️ Shared from gallery'
        when 'file' then '📎 File'
        else left(coalesce(_row ->> 'message', _row ->> 'text', ''), 120)
      end;

      _name := public._notif_display_name(_sender);
      perform public.notify_user(
        _recipient,
        'dm_new',
        _name || ' sent you a message',
        nullif(_body, ''),
        jsonb_build_object('sender_id', _sender, 'message_id', _message_id),
        _sender,
        'dm',
        _message_id
      );

      return NEW;
    exception when others then
      -- Notifications must never break message sending.
      raise warning 'trg_dm_notify skipped: %', SQLERRM;
      return NEW;
    end $BODY$;

    drop trigger if exists trg_dm_notify on public.direct_messages;
    create trigger trg_dm_notify
      after insert on public.direct_messages
      for each row execute function public.trg_dm_notify();
  end if;
end $$;

create or replace function public.send_test_notification()
returns uuid
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  return public.notify_user(
    auth.uid(),
    'system_broadcast',
    'Test notification 🔔',
    'Agar aap ko ye dikh raha hai to notifications kaam kar rahi hain.',
    jsonb_build_object('test', true),
    null,
    'notification_test',
    auth.uid()::text
  );
end $$;

grant execute on function public.send_test_notification() to authenticated;