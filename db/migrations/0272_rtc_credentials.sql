-- RTC (ZEGOCLOUD) credentials, editable from the admin panel.
-- Secret NEVER leaves the server: table is service_role only, admins read a
-- masked view / write through a security-definer RPC.

CREATE TABLE IF NOT EXISTS public.rtc_credentials (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  app_id bigint,
  server_secret text,
  server_url text DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT ALL ON public.rtc_credentials TO service_role;
-- no anon/authenticated grants on purpose

ALTER TABLE public.rtc_credentials ENABLE ROW LEVEL SECURITY;

-- Admin read: masked secret only.
CREATE OR REPLACE FUNCTION public.admin_get_rtc_config()
RETURNS TABLE (app_id bigint, secret_set boolean, secret_hint text, server_url text, updated_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
  SELECT c.app_id,
         (c.server_secret IS NOT NULL AND length(c.server_secret) > 0) AS secret_set,
         CASE WHEN c.server_secret IS NULL OR length(c.server_secret) = 0 THEN ''
              ELSE repeat('•', greatest(length(c.server_secret) - 4, 0)) || right(c.server_secret, 4) END AS secret_hint,
         coalesce(c.server_url, '') AS server_url,
         c.updated_at
  FROM public.rtc_credentials c
  WHERE c.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_rtc_config(
  _app_id bigint,
  _server_secret text DEFAULT NULL,
  _server_url text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _app_id IS NULL OR _app_id <= 0 THEN
    RAISE EXCEPTION 'app_id must be a positive number';
  END IF;

  INSERT INTO public.rtc_credentials (id, app_id, server_secret, server_url, updated_at, updated_by)
  VALUES (true, _app_id, nullif(_server_secret, ''), coalesce(_server_url, ''), now(), auth.uid())
  ON CONFLICT (id) DO UPDATE
    SET app_id = EXCLUDED.app_id,
        server_secret = coalesce(nullif(_server_secret, ''), public.rtc_credentials.server_secret),
        server_url = EXCLUDED.server_url,
        updated_at = now(),
        updated_by = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_rtc_config() FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_set_rtc_config(bigint, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_rtc_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_rtc_config(bigint, text, text) TO authenticated;
