INSERT INTO public.admin_role_permissions(role, permission)
VALUES ('admin'::public.app_role, 'finance.reports')
ON CONFLICT (role, permission) DO NOTHING;
