-- 0251_is_admin_email_alignment.sql
-- Align DB-side admin checks with the app's super-admin email fallback so
-- admin storage/uploads and admin writes don't fail when the user is the
-- configured super admin but has no user_roles row yet.

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role IN ('admin', 'super_admin')
    )
    OR (
      _user_id = auth.uid()
      AND lower(coalesce(auth.jwt() ->> 'email', '')) = 'jalwaapplive@gmail.com'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated, service_role;

INSERT INTO public._migrations (name)
SELECT '0251_is_admin_email_alignment.sql'
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = '_migrations'
)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';