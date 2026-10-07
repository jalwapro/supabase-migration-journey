-- Security hardening: admin roles must be explicitly assigned in user_roles.
-- Historical email-based triggers could grant admin roles automatically and
-- are no longer a valid authorization mechanism.
DROP TRIGGER IF EXISTS on_auth_user_created_grant_super_admin ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_super_admin ON auth.users;
DROP FUNCTION IF EXISTS public.grant_super_admin_for_known_email();

-- Keep role checks server-backed; do not expose an executable email-elevation
-- function to application roles.
