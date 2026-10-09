-- Role permissions for the JALWA admin console.
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
('admin','visuals.manage'),('admin','content.manage'),('admin','finance.view'),('admin','finance.reports'),
('admin','recharge.review'),('admin','withdrawals.review'),('admin','coin_sellers.view'),
('admin','coin_sellers.manage'),('admin','audit.view'),
('moderator','dashboard.view'),('moderator','users.view'),('moderator','rooms.view'),
('moderator','rankings.view'),('moderator','reports.manage'),
('agent','dashboard.view'),('agent','support.manage'),('agent','users.lookup'),('agent','finance.status'),
('finance_operator','dashboard.view'),('finance_operator','finance.view'),('finance_operator','finance.reports'),
('super_admin','dashboard.view'),('super_admin','users.view'),('super_admin','rooms.view'),
('super_admin','rankings.view'),('super_admin','reports.manage'),('super_admin','support.manage'),
('super_admin','notifications.manage'),('super_admin','visuals.manage'),('super_admin','content.manage'),
('super_admin','finance.view'),('super_admin','coin_sellers.view'),('super_admin','coin_sellers.manage'),
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
