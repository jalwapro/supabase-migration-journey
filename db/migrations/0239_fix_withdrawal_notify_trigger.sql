-- Fix trg_withdrawal_notify: enum recharge_status has no value 'paid'.
-- Discovered via tests/e2e/flows.test.sql.

CREATE OR REPLACE FUNCTION public.trg_withdrawal_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if TG_OP = 'UPDATE' and NEW.status is distinct from OLD.status then
    if NEW.status = 'approved' then
      perform public.notify_user(
        NEW.user_id, 'withdrawal_approved',
        'Withdrawal approved',
        'Your withdrawal request has been processed.',
        jsonb_build_object('request_id', NEW.id, 'amount_pkr', NEW.amount_pkr),
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
end
$function$;
