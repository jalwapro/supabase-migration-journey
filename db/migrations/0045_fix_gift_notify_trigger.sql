-- Fix: 0044 attached trg_gift_notify to public.gift_events (which has no
-- receiver_id column), causing "record 'new' has no field 'receiver_id'"
-- on every gift send. Move the notification trigger to public.gift_sends,
-- which has (sender_id, receiver_id, gift_id, coins_spent, diamonds_earned).

-- Drop the broken trigger + function from 0044
drop trigger if exists trg_gifts_notify on public.gift_events;
drop function if exists public.trg_gift_notify();

-- Recreate on gift_sends
do $$ begin
  if to_regclass('public.gift_sends') is not null then
    create or replace function public.trg_gift_send_notify() returns trigger
    language plpgsql security definer set search_path = public as $BODY$
    declare _sender text;
    begin
      if NEW.receiver_id is null or NEW.receiver_id = NEW.sender_id then
        return NEW;
      end if;
      _sender := public._notif_display_name(NEW.sender_id);
      perform public.notify_user(
        NEW.receiver_id,
        'gift_received',
        _sender || ' sent you a gift',
        null,
        jsonb_build_object(
          'sender_id', NEW.sender_id,
          'gift_id', NEW.gift_id,
          'quantity', NEW.quantity,
          'coins_spent', NEW.coins_spent,
          'diamonds_earned', NEW.diamonds_earned
        ),
        NEW.sender_id,
        'gift_send',
        NEW.id::text
      );
      return NEW;
    end $BODY$;

    drop trigger if exists trg_gift_sends_notify on public.gift_sends;
    create trigger trg_gift_sends_notify
      after insert on public.gift_sends
      for each row execute function public.trg_gift_send_notify();
  end if;
end $$;
