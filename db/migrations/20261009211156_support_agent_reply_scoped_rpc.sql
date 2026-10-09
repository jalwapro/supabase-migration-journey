CREATE OR REPLACE FUNCTION public.support_agent_reply_ticket(_ticket_id uuid, _reply text, _status text DEFAULT 'closed')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_status text := coalesce(_status, 'closed');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.has_admin_permission('support.manage') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _ticket_id IS NULL THEN RAISE EXCEPTION 'TICKET_REQUIRED'; END IF;
  IF v_status NOT IN ('open','closed') THEN RAISE EXCEPTION 'INVALID_TICKET_STATUS'; END IF;
  IF length(btrim(coalesce(_reply,'')))=0 THEN RAISE EXCEPTION 'REPLY_REQUIRED'; END IF;
  UPDATE public.support_tickets SET admin_reply=left(btrim(_reply),4000), status=v_status WHERE id=_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'TICKET_NOT_FOUND'; END IF;
  INSERT INTO public.admin_logs(admin_id,action,target) VALUES(v_uid,'support.ticket_reply',_ticket_id::text);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.support_agent_reply_ticket(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_agent_reply_ticket(uuid,text,text) TO authenticated;
DROP POLICY IF EXISTS "Support agents update tickets" ON public.support_tickets;
