-- Keep role grants super-admin-only; include the scoped finance operator role.
CREATE OR REPLACE FUNCTION public.manage_user_role(_user_id uuid, _role text, _action text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_actor uuid := auth.uid(); v_count integer; v_existing boolean; v_role public.app_role;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_actor AND role='super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'SUPER_ADMIN_REQUIRED';
  END IF;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'USER_REQUIRED'; END IF;
  IF _role IS NULL OR _role NOT IN ('host','agent','moderator','admin','super_admin','finance_operator') THEN
    RAISE EXCEPTION 'INVALID_ROLE';
  END IF;
  v_role := _role::public.app_role;
  IF _action NOT IN ('grant','revoke') THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;
  IF _action='grant' THEN
    INSERT INTO public.user_roles(user_id,role) VALUES (_user_id,v_role) ON CONFLICT (user_id,role) DO NOTHING;
    RETURN true;
  END IF;
  IF _user_id=v_actor THEN RAISE EXCEPTION 'SELF_REVOCATION_FORBIDDEN'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=v_role) INTO v_existing;
  IF NOT v_existing THEN RETURN false; END IF;
  IF v_role='super_admin'::public.app_role THEN
    SELECT count(*) INTO v_count FROM public.user_roles WHERE role='super_admin'::public.app_role;
    IF v_count<=1 THEN RAISE EXCEPTION 'LAST_SUPER_ADMIN_PROTECTED'; END IF;
  END IF;
  DELETE FROM public.user_roles WHERE user_id=_user_id AND role=v_role;
  RETURN true;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.manage_user_role(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_user_role(uuid,text,text) TO authenticated;
