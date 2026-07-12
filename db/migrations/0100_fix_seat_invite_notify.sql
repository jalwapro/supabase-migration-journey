-- Fix column names in seat_invite notify trigger: table uses from_user/to_user.
create or replace function public.trg_seat_invite_notify() returns trigger
language plpgsql security definer set search_path = public as $BODY$
declare _host text;
begin
  _host := public._notif_display_name(NEW.from_user);
  perform public.notify_user(
    NEW.to_user, 'seat_invite',
    _host || ' invited you to a seat',
    null,
    jsonb_build_object('room_id', NEW.room_id, 'seat_index', NEW.seat_index),
    NEW.from_user, 'room', NEW.room_id::text
  );
  return NEW;
end $BODY$;

drop trigger if exists trg_seat_invite_notify on public.seat_invites;
create trigger trg_seat_invite_notify
  after insert on public.seat_invites
  for each row execute function public.trg_seat_invite_notify();
