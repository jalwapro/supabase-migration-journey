-- Add vip_level column used by ranking + VIP UI, and ensure jalwaapplive@gmail.com
-- has admin/super_admin roles regardless of email_confirmed_at state.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vip_level integer NOT NULL DEFAULT 0;

-- Backfill roles for the known super admin whether or not email is confirmed.
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

-- Relax trigger so the roles are granted at sign-up even before email confirmation.
CREATE OR REPLACE FUNCTION public.grant_super_admin_for_known_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = 'jalwaapplive@gmail.com' THEN
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
