-- Grant super_admin + admin role to jalwaapplive@gmail.com
-- Runs safely whether the user has signed up yet or not.

-- 1) Backfill: if the user already exists in auth.users, insert both roles.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = 'jalwaapplive@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = 'jalwaapplive@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Trigger: whenever this exact verified email signs up (or gets confirmed),
--    auto-grant the roles. Verified-email check protects against sign-up
--    impersonation (email must be confirmed before role is granted).
CREATE OR REPLACE FUNCTION public.grant_super_admin_for_known_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) = 'jalwaapplive@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin'), (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_super_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_super_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_super_admin_for_known_email();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_super_admin ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_grant_super_admin
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_super_admin_for_known_email();
