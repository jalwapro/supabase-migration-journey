-- Scoped admin permissions, role governance, report moderation and support ticket access.
CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
  role public.app_role NOT NULL,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission)
);
ALTER TABLE public.admin_role_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_role_permissions FROM anon, authenticated;

INSERT INTO public.admin_role_permissions(role, permission) VALUES
('admin','dashboard.view'),('admin','users.view'),('admin','rooms.view'),('admin','rankings.view'),
('admin','reports.manage'),('admin','support.manage'),('admin','notifications.manage'),
('admin','visuals.manage'),('admin','content.manage'),('admin','finance.view'),('admin','coin_sellers.view'),('admin','audit.view'),
('moderator','dashboard.view'),('moderator','users.view'),('moderator','rooms.view'),('moderator','rankings.view'),('moderator','reports.manage'),
('agent','dashboard.view'),('agent','support.manage'),('agent','users.lookup'),('agent','finance.status'),
('finance_operator','dashboard.view'),('finance_operator','finance.view'),('finance_operator','finance.reports'),('finance_operator','coin_sellers.view'),
('super_admin','dashboard.view'),('super_admin','users.view'),('super_admin','rooms.view'),('super_admin','rankings.view'),
('super_admin','reports.manage'),('super_admin','support.manage'),('super_admin','notifications.manage'),('super_admin','visuals.manage'),
('super_admin','content.manage'),('super_admin','finance.view'),('super_admin','coin_sellers.view'),('super_admin','coin_sellers.manage'),
('super_admin','finance.reports'),('super_admin','recharge.review'),('super_admin','withdrawals.review'),
('super_admin','payment_accounts.manage'),('super_admin','audit.view'),('super_admin','system.manage'),
('super_admin','integrations.manage'),('super_admin','roles.manage'),('super_admin','factory_reset')
ON CONFLICT (role, permission) DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_admin_permission(_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
SELECT auth.uid() IS NOT NULL AND (
 EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=auth.uid() AND ur.role='super_admin'::public.app_role)
 OR EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.admin_role_permissions arp ON arp.role=ur.role
            WHERE ur.user_id=auth.uid() AND arp.permission=_permission)
);
$$;
CREATE OR REPLACE FUNCTION public.get_my_admin_permissions()
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
SELECT COALESCE(array_agg(DISTINCT arp.permission ORDER BY arp.permission), ARRAY[]::text[])
FROM public.user_roles ur JOIN public.admin_role_permissions arp ON arp.role=ur.role
WHERE ur.user_id=auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.has_admin_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_admin_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_admin_permissions() TO authenticated;

CREATE OR REPLACE FUNCTION public.manage_user_role(_user_id uuid, _role text, _action text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_actor uuid:=auth.uid(); v_count integer; v_existing boolean; v_role public.app_role;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_actor AND role='super_admin'::public.app_role) THEN RAISE EXCEPTION 'SUPER_ADMIN_REQUIRED'; END IF;
 IF _user_id IS NULL THEN RAISE EXCEPTION 'USER_REQUIRED'; END IF;
 IF _role IS NULL OR _role NOT IN ('host','agent','moderator','admin','super_admin','finance_operator') THEN RAISE EXCEPTION 'INVALID_ROLE'; END IF;
 v_role:=_role::public.app_role;
 IF _action NOT IN ('grant','revoke') THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;
 IF _action='grant' THEN
   INSERT INTO public.user_roles(user_id,role) VALUES(_user_id,v_role) ON CONFLICT(user_id,role) DO NOTHING; RETURN true;
 END IF;
 IF _user_id=v_actor THEN RAISE EXCEPTION 'SELF_REVOCATION_FORBIDDEN'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=v_role) INTO v_existing;
 IF NOT v_existing THEN RETURN false; END IF;
 IF v_role='super_admin'::public.app_role THEN
   SELECT count(*) INTO v_count FROM public.user_roles WHERE role='super_admin'::public.app_role;
   IF v_count<=1 THEN RAISE EXCEPTION 'LAST_SUPER_ADMIN_PROTECTED'; END IF;
 END IF;
 DELETE FROM public.user_roles WHERE user_id=_user_id AND role=v_role; RETURN true;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.manage_user_role(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_user_role(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_reports(p_status text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid, reporter_id uuid, reporter_username text, reporter_avatar text, reported_user_id uuid, reported_username text, reported_avatar text, room_id uuid, room_title text, reason text, details text, status text, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = 'public'
AS $function$
SELECT r.id,r.reporter_id,rp.username,rp.avatar,r.reported_user_id,tp.username,tp.avatar,
       r.room_id,lr.title,r.reason,r.details,r.status,r.created_at
FROM public.user_reports r LEFT JOIN public.profiles rp ON rp.id=r.reporter_id
LEFT JOIN public.profiles tp ON tp.id=r.reported_user_id LEFT JOIN public.live_rooms lr ON lr.id=r.room_id
WHERE r.status=p_status AND public.has_admin_permission('reports.manage')
ORDER BY r.created_at DESC,r.id DESC LIMIT GREATEST(1,LEAST(p_limit,100)) OFFSET GREATEST(0,p_offset);
$function$;
REVOKE EXECUTE ON FUNCTION public.get_admin_reports(text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_reports(text,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_report_status(_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $function$
DECLARE me uuid:=auth.uid(); r public.user_reports%ROWTYPE;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
 IF NOT public.has_admin_permission('reports.manage') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF _status NOT IN ('resolved','dismissed','pending') THEN RAISE EXCEPTION 'invalid status'; END IF;
 UPDATE public.user_reports SET status=_status WHERE id=_id RETURNING * INTO r;
 IF NOT FOUND THEN RAISE EXCEPTION 'report not found'; END IF;
 INSERT INTO public.admin_logs(admin_id,action,target) VALUES(me,'report_'||_status,_id::text);
 IF _status IN ('resolved','dismissed') AND r.reporter_id IS NOT NULL THEN
  BEGIN
   INSERT INTO public.notifications(user_id,kind,title,body,data) VALUES(r.reporter_id,'report_update',
    CASE WHEN _status='resolved' THEN 'Report reviewed' ELSE 'Report closed' END,
    CASE WHEN _status='resolved' THEN 'Thanks — we took action on your report.' ELSE 'We reviewed your report and no action was needed.' END,
    jsonb_build_object('report_id',_id));
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'notify failed: %',SQLERRM;
  END;
 END IF;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.set_report_status(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_report_status(uuid,text) TO authenticated;

DROP POLICY IF EXISTS "Support agents view tickets" ON public.support_tickets;
CREATE POLICY "Support agents view tickets" ON public.support_tickets FOR SELECT TO authenticated USING(public.has_admin_permission('support.manage'));
DROP POLICY IF EXISTS "Support agents update tickets" ON public.support_tickets;
CREATE POLICY "Support agents update tickets" ON public.support_tickets FOR UPDATE TO authenticated USING(public.has_admin_permission('support.manage')) WITH CHECK(public.has_admin_permission('support.manage'));
DROP POLICY IF EXISTS "Moderators view reports" ON public.user_reports;
CREATE POLICY "Moderators view reports" ON public.user_reports FOR SELECT TO authenticated USING(public.has_admin_permission('reports.manage'));
DROP POLICY IF EXISTS "Moderators update reports" ON public.user_reports;
CREATE POLICY "Moderators update reports" ON public.user_reports FOR UPDATE TO authenticated USING(public.has_admin_permission('reports.manage')) WITH CHECK(public.has_admin_permission('reports.manage'));
