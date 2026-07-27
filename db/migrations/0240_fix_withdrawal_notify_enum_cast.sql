-- Fix _notify_withdrawal_status_change: cast pay_method enum to text before coalesce/concat.
-- Discovered via tests/e2e/flows.test.sql.

CREATE OR REPLACE FUNCTION public._notify_withdrawal_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if new.status is distinct from old.status
     and new.status in ('approved', 'rejected') then
    insert into public.notifications (user_id, kind, title, body, entity_type, entity_id)
    values (
      new.user_id,
      case when new.status = 'approved' then 'withdrawal_approved' else 'withdrawal_rejected' end,
      case when new.status = 'approved'
             then 'Withdrawal approved 💸'
             else 'Withdrawal rejected'
      end,
      case when new.status = 'approved'
             then 'PKR ' || new.amount_pkr::text || ' payout approved to ' ||
                  coalesce(new.method::text, 'your account') || '.'
             else coalesce(new.admin_note,
                    'Your withdrawal was rejected. Diamonds have been refunded.')
      end,
      'withdrawal_request',
      new.id
    );
  end if;
  return new;
end;
$function$;
