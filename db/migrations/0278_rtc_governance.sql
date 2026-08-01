-- ZEGOCLOUD governance: environments, verification state, change history,
-- rollback and an audit trail for every credential mutation.

ALTER TABLE public.rtc_credential_pool
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'production',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verify_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verify_error text;

DO $$ BEGIN
  ALTER TABLE public.rtc_credential_pool
    ADD CONSTRAINT rtc_pool_env_chk CHECK (environment IN ('development','staging','production'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------------ history
CREATE TABLE IF NOT EXISTS public.rtc_config_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot int NOT NULL,
  action text NOT NULL,
  label text NOT NULL DEFAULT '',
  app_id bigint,
  server_secret text,
  server_url text NOT NULL DEFAULT '',
  environment text NOT NULL DEFAULT 'production',
  minutes_limit numeric NOT NULL DEFAULT 10000,
  enabled boolean NOT NULL DEFAULT true,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rtc_history_slot ON public.rtc_config_history (slot, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rtc_history_created ON public.rtc_config_history (created_at DESC);

GRANT ALL ON public.rtc_config_history TO service_role;
-- no anon/authenticated grants: secrets stay server-side, reads go via RPC
ALTER TABLE public.rtc_config_history ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------- upsert + log
CREATE OR REPLACE FUNCTION public.admin_upsert_rtc_slot(
  _slot int,
  _app_id bigint,
  _server_secret text DEFAULT NULL,
  _server_url text DEFAULT '',
  _label text DEFAULT '',
  _minutes_limit numeric DEFAULT 10000,
  _enabled boolean DEFAULT true,
  _environment text DEFAULT 'production'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing public.rtc_credential_pool%ROWTYPE;
  v_secret text;
  v_env text := coalesce(nullif(_environment, ''), 'production');
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _slot IS NULL OR _slot < 1 OR _slot > 50 THEN RAISE EXCEPTION 'slot must be 1-50'; END IF;
  IF _app_id IS NULL OR _app_id <= 0 THEN RAISE EXCEPTION 'AppID must be a positive number'; END IF;
  IF v_env NOT IN ('development','staging','production') THEN RAISE EXCEPTION 'invalid environment'; END IF;

  SELECT * INTO v_existing FROM public.rtc_credential_pool WHERE slot = _slot;
  v_secret := coalesce(nullif(_server_secret, ''), v_existing.server_secret);
  IF v_secret IS NULL OR v_secret = '' THEN RAISE EXCEPTION 'ServerSecret required'; END IF;
  IF length(v_secret) <> 32 THEN RAISE EXCEPTION 'ServerSecret must be exactly 32 characters'; END IF;

  -- snapshot the previous config so it can be rolled back to
  IF v_existing.slot IS NOT NULL THEN
    INSERT INTO public.rtc_config_history
      (slot, action, label, app_id, server_secret, server_url, environment, minutes_limit, enabled, changed_by)
    VALUES
      (v_existing.slot, 'snapshot', coalesce(v_existing.label, ''), v_existing.app_id, v_existing.server_secret,
       coalesce(v_existing.server_url, ''), coalesce(v_existing.environment, 'production'),
       v_existing.minutes_limit, v_existing.enabled, auth.uid());
  END IF;

  INSERT INTO public.rtc_credential_pool
    (slot, label, app_id, server_secret, server_url, minutes_limit, enabled, environment, updated_at)
  VALUES
    (_slot, coalesce(_label, ''), _app_id, v_secret, coalesce(_server_url, ''),
     greatest(coalesce(_minutes_limit, 10000), 1), coalesce(_enabled, true), v_env, now())
  ON CONFLICT (slot) DO UPDATE SET
    label = EXCLUDED.label,
    app_id = EXCLUDED.app_id,
    server_secret = EXCLUDED.server_secret,
    server_url = EXCLUDED.server_url,
    minutes_limit = EXCLUDED.minutes_limit,
    enabled = EXCLUDED.enabled,
    environment = EXCLUDED.environment,
    verified_at = CASE WHEN public.rtc_credential_pool.app_id = EXCLUDED.app_id
                        AND public.rtc_credential_pool.server_secret = EXCLUDED.server_secret
                       THEN public.rtc_credential_pool.verified_at ELSE NULL END,
    verify_status = CASE WHEN public.rtc_credential_pool.app_id = EXCLUDED.app_id
                          AND public.rtc_credential_pool.server_secret = EXCLUDED.server_secret
                         THEN public.rtc_credential_pool.verify_status ELSE 'unverified' END,
    updated_at = now();

  INSERT INTO public.rtc_config_history
    (slot, action, label, app_id, server_secret, server_url, environment, minutes_limit, enabled, changed_by)
  VALUES
    (_slot, CASE WHEN v_existing.slot IS NULL THEN 'create' ELSE 'update' END,
     coalesce(_label, ''), _app_id, v_secret, coalesce(_server_url, ''), v_env,
     greatest(coalesce(_minutes_limit, 10000), 1), coalesce(_enabled, true), auth.uid());
END; $$;

-- old 7-arg overload removed: it made named-arg RPC calls ambiguous.
DROP FUNCTION IF EXISTS public.admin_upsert_rtc_slot(int, bigint, text, text, text, numeric, boolean);

-- ------------------------------------------------------------------ listing
DROP FUNCTION IF EXISTS public.admin_list_rtc_pool();
CREATE OR REPLACE FUNCTION public.admin_list_rtc_pool()
RETURNS TABLE (
  id uuid, slot int, label text, app_id bigint, secret_hint text,
  server_url text, minutes_limit numeric, minutes_used numeric,
  exhausted boolean, enabled boolean, last_used_at timestamptz,
  environment text, verified_at timestamptz, verify_status text, verify_error text,
  updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
  SELECT p.id, p.slot, coalesce(p.label, ''), p.app_id,
         repeat('•', greatest(length(p.server_secret) - 4, 0)) || right(p.server_secret, 4),
         p.server_url, p.minutes_limit, p.minutes_used, p.exhausted, p.enabled, p.last_used_at,
         p.environment, p.verified_at, p.verify_status, p.verify_error, p.updated_at
  FROM public.rtc_credential_pool p
  ORDER BY p.slot;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_rtc_history(_limit int DEFAULT 50)
RETURNS TABLE (
  id uuid, slot int, action text, label text, app_id bigint, secret_hint text,
  server_url text, environment text, enabled boolean,
  changed_by uuid, changed_by_name text, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
  SELECT h.id, h.slot, h.action, h.label, h.app_id,
         repeat('•', greatest(length(coalesce(h.server_secret, '')) - 4, 0)) || right(coalesce(h.server_secret, ''), 4),
         h.server_url, h.environment, h.enabled, h.changed_by,
         coalesce(pr.username, pr.display_name, left(h.changed_by::text, 8)),
         h.created_at
  FROM public.rtc_config_history h
  LEFT JOIN public.profiles pr ON pr.id = h.changed_by
  ORDER BY h.created_at DESC
  LIMIT greatest(coalesce(_limit, 50), 1);
END; $$;

-- ----------------------------------------------------------------- rollback
CREATE OR REPLACE FUNCTION public.admin_rollback_rtc_slot(_history_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h public.rtc_config_history%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT * INTO h FROM public.rtc_config_history WHERE id = _history_id;
  IF h.id IS NULL THEN RAISE EXCEPTION 'history entry not found'; END IF;
  IF coalesce(h.server_secret, '') = '' OR h.app_id IS NULL THEN
    RAISE EXCEPTION 'this history entry has no restorable credential';
  END IF;

  PERFORM public.admin_upsert_rtc_slot(
    h.slot, h.app_id, h.server_secret, h.server_url, h.label, h.minutes_limit, h.enabled, h.environment
  );

  INSERT INTO public.rtc_config_history
    (slot, action, label, app_id, server_secret, server_url, environment, minutes_limit, enabled, changed_by)
  VALUES (h.slot, 'rollback', h.label, h.app_id, h.server_secret, h.server_url, h.environment,
          h.minutes_limit, h.enabled, auth.uid());
END; $$;

-- --------------------------------------------- verification state (service)
CREATE OR REPLACE FUNCTION public.rtc_set_verify_state(
  _slot int, _status text, _error text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.rtc_credential_pool
     SET verify_status = coalesce(_status, 'unverified'),
         verify_error = _error,
         verified_at = CASE WHEN _status = 'verified' THEN now() ELSE verified_at END,
         updated_at = now()
   WHERE slot = _slot;
END; $$;

-- delete also gets an audit line
CREATE OR REPLACE FUNCTION public.admin_delete_rtc_slot(_slot int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.rtc_credential_pool%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT * INTO v FROM public.rtc_credential_pool WHERE slot = _slot;
  IF v.slot IS NOT NULL THEN
    INSERT INTO public.rtc_config_history
      (slot, action, label, app_id, server_secret, server_url, environment, minutes_limit, enabled, changed_by)
    VALUES (v.slot, 'delete', coalesce(v.label, ''), v.app_id, v.server_secret, coalesce(v.server_url, ''),
            coalesce(v.environment, 'production'), v.minutes_limit, v.enabled, auth.uid());
  END IF;
  DELETE FROM public.rtc_credential_pool WHERE slot = _slot;
END; $$;

-- ------------------------------------------------------------------- grants
REVOKE ALL ON FUNCTION public.admin_upsert_rtc_slot(int, bigint, text, text, text, numeric, boolean, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_list_rtc_history(int) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_rollback_rtc_slot(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.rtc_set_verify_state(int, text, text) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_upsert_rtc_slot(int, bigint, text, text, text, numeric, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_rtc_history(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_rollback_rtc_slot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rtc_set_verify_state(int, text, text) TO service_role;

-- re-grant recreated functions (DROP removed prior grants)
REVOKE ALL ON FUNCTION public.admin_list_rtc_pool() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_rtc_pool() TO authenticated;
