-- Security hardening: admin roles must be explicitly assigned in user_roles.
-- The historical email-based trigger could grant super_admin/admin before
-- email confirmation and is no longer a valid authorization mechanism.
DROP TRIGGER IF EXISTS on_auth_user_created_grant_super_admin ON auth.users;
DROP FUNCTION IF EXISTS public.grant_super_admin_for_known_email();

-- Keep role checks server-backed; do not expose an executable email-elevation
-- function to application roles.
