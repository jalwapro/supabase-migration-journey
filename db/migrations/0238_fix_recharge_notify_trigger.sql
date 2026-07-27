-- Fix trg_recharge_notify: recharge_requests has no column `amount`.
-- Use `amount_paid` (canonical) and include `coins` for the notification payload.
-- Discovered via tests/e2e/flows.test.sql.

CREATE OR REPLACE FUNCTION public.trg_recharge_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if TG_OP = 'UPDATE' and NEW.status is distinct from OLD.status then
    if NEW.status = 'approved' then
      perform public.notify_user(
        NEW.user_id, 'recharge_approved',
        'Recharge approved',
        'Your recharge has been credited to your wallet.',
        jsonb_build_object(
          'request_id', NEW.id,
          'amount_paid', NEW.amount_paid,
          'coins', NEW.coins
        ),
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
end
$function$;
