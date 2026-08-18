-- Fix App Studio admin visibility to use the canonical is_admin() helper.
-- This keeps App Studio admin-only while allowing the existing admin identity
-- check (including the configured admin email) to read/write customization data.

CREATE OR REPLACE FUNCTION public.app_customization_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_admin(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.app_customization_admin() TO authenticated;
