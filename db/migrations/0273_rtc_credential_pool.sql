-- ZEGOCLOUD credential POOL: up to N manual IDs with automatic rotation.
-- When an ID's minute quota runs out it is marked exhausted and traffic
-- shifts to the next slot. When every slot is exhausted the cycle resets
-- and starts again from slot 1.

CREATE TABLE IF NOT EXISTS public.rtc_credential_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot int NOT NULL UNIQUE CHECK (slot >= 1 AND slot <= 50),
  label text DEFAULT '',
  app_id bigint NOT NULL,
  server_secret text NOT NULL,
  server_url text NOT NULL DEFAULT '',
  minutes_limit numeric NOT NULL DEFAULT 10000,
  minutes_used numeric NOT NULL DEFAULT 0,
  exhausted boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rtc_pool_pick ON public.rtc_credential_pool (enabled, exhausted, slot);

GRANT ALL ON public.rtc_credential_pool TO service_role;
-- deliberately NO anon/authenticated grants: secrets stay server-side

ALTER TABLE public.rtc_credential_pool ENABLE ROW LEVEL SECURITY;

-- Seed slot 1 from the single-credential table when present.
INSERT INTO public.rtc_credential_pool (slot, label, app_id, server_secret, server_url)
SELECT 1, 'Primary', c.app_id, c.server_secret, coalesce(c.server_url, '')
FROM public.rtc_credentials c
WHERE c.id AND c.app_id IS NOT NULL AND coalesce(c.server_secret, '') <> ''
ON CONFLICT (slot) DO NOTHING;

-- ---------------------------------------------------------------- admin API
CREATE OR REPLACE FUNCTION public.admin_list_rtc_pool()
RETURNS TABLE (
  id uuid, slot int, label text, app_id bigint, secret_hint text,
  server_url text, minutes_limit numeric, minutes_used numeric,
  exhausted boolean, enabled boolean, last_used_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
  SELECT p.id, p.slot, coalesce(p.label, ''), p.app_id,
         repeat('•', greatest(length(p.server_secret) - 4, 0)) || right(p.server_secret, 4),
         p.server_url, p.minutes_limit, p.minutes_used, p.exhausted, p.enabled, p.last_used_at
  FROM public.rtc_credential_pool p
  ORDER BY p.slot;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_upsert_rtc_slot(
  _slot int,
  _app_id bigint,
  _server_secret text DEFAULT NULL,
  _server_url text DEFAULT '',
  _label text DEFAULT '',
  _minutes_limit numeric DEFAULT 10000,
  _enabled boolean DEFAULT true
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_existing text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _slot IS NULL OR _slot < 1 OR _slot > 50 THEN RAISE EXCEPTION 'slot must be 1-50'; END IF;
  IF _app_id IS NULL OR _app_id <= 0 THEN RAISE EXCEPTION 'AppID must be a positive number'; END IF;

  SELECT server_secret INTO v_existing FROM public.rtc_credential_pool WHERE slot = _slot;
  IF coalesce(nullif(_server_secret, ''), v_existing) IS NULL THEN
    RAISE EXCEPTION 'ServerSecret required';
  END IF;

  INSERT INTO public.rtc_credential_pool
    (slot, label, app_id, server_secret, server_url, minutes_limit, enabled, updated_at)
  VALUES
    (_slot, coalesce(_label, ''), _app_id, coalesce(nullif(_server_secret, ''), v_existing),
     coalesce(_server_url, ''), greatest(coalesce(_minutes_limit, 10000), 1), coalesce(_enabled, true), now())
  ON CONFLICT (slot) DO UPDATE SET
    label = EXCLUDED.label,
    app_id = EXCLUDED.app_id,
    server_secret = EXCLUDED.server_secret,
    server_url = EXCLUDED.server_url,
    minutes_limit = EXCLUDED.minutes_limit,
    enabled = EXCLUDED.enabled,
    updated_at = now();
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_rtc_slot(_slot int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM public.rtc_credential_pool WHERE slot = _slot;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_reset_rtc_slot(_slot int DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.rtc_credential_pool
     SET minutes_used = 0, exhausted = false, updated_at = now()
   WHERE _slot IS NULL OR slot = _slot;
END; $$;

-- ------------------------------------------------------- runtime rotation API
-- Picks the lowest enabled, non-exhausted slot. If every slot is used up,
-- the whole cycle resets so rotation starts again from slot 1.
CREATE OR REPLACE FUNCTION public.rtc_pick_credential()
RETURNS TABLE (slot int, app_id bigint, server_secret text, server_url text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  SELECT p.* INTO r FROM public.rtc_credential_pool p
   WHERE p.enabled AND NOT p.exhausted ORDER BY p.slot LIMIT 1;

  IF r IS NULL THEN
    -- full cycle finished → reset and start from slot 1
    UPDATE public.rtc_credential_pool SET minutes_used = 0, exhausted = false, updated_at = now()
     WHERE enabled;
    SELECT p.* INTO r FROM public.rtc_credential_pool p
     WHERE p.enabled ORDER BY p.slot LIMIT 1;
  END IF;

  IF r IS NULL THEN RETURN; END IF;

  UPDATE public.rtc_credential_pool SET last_used_at = now() WHERE id = r.id;
  RETURN QUERY SELECT r.slot, r.app_id, r.server_secret, r.server_url;
END; $$;

-- Consumes minutes against an AppID; flips it to exhausted at the limit.
CREATE OR REPLACE FUNCTION public.rtc_report_usage(_app_id bigint, _minutes numeric)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ex boolean;
BEGIN
  UPDATE public.rtc_credential_pool
     SET minutes_used = minutes_used + greatest(coalesce(_minutes, 0), 0),
         exhausted = (minutes_used + greatest(coalesce(_minutes, 0), 0)) >= minutes_limit,
         updated_at = now()
   WHERE app_id = _app_id
  RETURNING exhausted INTO v_ex;
  RETURN coalesce(v_ex, false);
END; $$;

-- Immediately retires an AppID (called when ZEGO rejects with a quota error).
CREATE OR REPLACE FUNCTION public.rtc_mark_exhausted(_app_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.rtc_credential_pool
     SET exhausted = true, minutes_used = greatest(minutes_used, minutes_limit), updated_at = now()
   WHERE app_id = _app_id;
END; $$;

REVOKE ALL ON FUNCTION public.admin_list_rtc_pool() FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_upsert_rtc_slot(int, bigint, text, text, text, numeric, boolean) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_delete_rtc_slot(int) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_reset_rtc_slot(int) FROM public, anon;
REVOKE ALL ON FUNCTION public.rtc_pick_credential() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.rtc_report_usage(bigint, numeric) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.rtc_mark_exhausted(bigint) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_list_rtc_pool() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_rtc_slot(int, bigint, text, text, text, numeric, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_rtc_slot(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_rtc_slot(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rtc_pick_credential() TO service_role;
GRANT EXECUTE ON FUNCTION public.rtc_report_usage(bigint, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.rtc_mark_exhausted(bigint) TO service_role;
