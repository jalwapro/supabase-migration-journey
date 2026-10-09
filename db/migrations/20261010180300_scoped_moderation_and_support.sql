-- Allow assigned moderators to review reports and support agents to answer tickets.
CREATE OR REPLACE FUNCTION public.get_admin_reports(p_status text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid, reporter_id uuid, reporter_username text, reporter_avatar text, reported_user_id uuid, reported_username text, reported_avatar text, room_id uuid, room_title text, reason text, details text, status text, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = 'public'
AS $function$
SELECT r.id, r.reporter_id, rp.username, rp.avatar, r.reported_user_id, tp.username, tp.avatar,
       r.room_id, lr.title, r.reason, r.details, r.status, r.created_at
FROM public.user_reports r
LEFT JOIN public.profiles rp ON rp.id=r.reporter_id
LEFT JOIN public.profiles tp ON tp.id=r.reported_user_id
LEFT JOIN public.live_rooms lr ON lr.id=r.room_id
WHERE r.status=p_status AND public.has_admin_permission('reports.manage')
ORDER BY r.created_at DESC, r.id DESC
LIMIT GREATEST(1,LEAST(p_limit,100)) OFFSET GREATEST(0,p_offset);
$function$;
REVOKE EXECUTE ON FUNCTION public.get_admin_reports(text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_reports(text,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_report_status(_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $function$
DECLARE me uuid := auth.uid(); r public.user_reports%ROWTYPE;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.has_admin_permission('reports.manage') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _status NOT IN ('resolved','dismissed','pending') THEN RAISE EXCEPTION 'invalid status'; END IF;
  UPDATE public.user_reports SET status=_status WHERE id=_id RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'report not found'; END IF;
  INSERT INTO public.admin_logs(admin_id,action,target) VALUES (me,'report_'||_status,_id::text);
  IF _status IN ('resolved','dismissed') AND r.reporter_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.notifications(user_id,kind,title,body,data)
      VALUES (r.reporter_id,'report_update',
        CASE WHEN _status='resolved' THEN 'Report reviewed' ELSE 'Report closed' END,
        CASE WHEN _status='resolved' THEN 'Thanks — we took action on your report.' ELSE 'We reviewed your report and no action was needed.' END,
        jsonb_build_object('report_id',_id));
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'notify failed: %', SQLERRM;
    END;
  END IF;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.set_report_status(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_report_status(uuid,text) TO authenticated;

DROP POLICY IF EXISTS "Support agents view tickets" ON public.support_tickets;
CREATE POLICY "Support agents view tickets" ON public.support_tickets FOR SELECT TO authenticated
USING (public.has_admin_permission('support.manage'));
DROP POLICY IF EXISTS "Support agents update tickets" ON public.support_tickets;
CREATE POLICY "Support agents update tickets" ON public.support_tickets FOR UPDATE TO authenticated
USING (public.has_admin_permission('support.manage')) WITH CHECK (public.has_admin_permission('support.manage'));

DROP POLICY IF EXISTS "Moderators view reports" ON public.user_reports;
CREATE POLICY "Moderators view reports" ON public.user_reports FOR SELECT TO authenticated
USING (public.has_admin_permission('reports.manage'));
DROP POLICY IF EXISTS "Moderators update reports" ON public.user_reports;
CREATE POLICY "Moderators update reports" ON public.user_reports FOR UPDATE TO authenticated
USING (public.has_admin_permission('reports.manage')) WITH CHECK (public.has_admin_permission('reports.manage'));
