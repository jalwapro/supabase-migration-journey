-- ============================================================================
-- 0055 — VIP admin: allow admins to edit vip_level_config + read admin logs
-- ============================================================================

GRANT INSERT, UPDATE, DELETE ON public.vip_level_config TO authenticated;

DROP POLICY IF EXISTS vip_cfg_admin_write ON public.vip_level_config;
CREATE POLICY vip_cfg_admin_write
  ON public.vip_level_config
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Admin logs read (if not already)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='vip_admin_logs') THEN
    EXECUTE 'GRANT SELECT, INSERT ON public.vip_admin_logs TO authenticated';
    EXECUTE 'ALTER TABLE public.vip_admin_logs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS vip_admin_logs_read ON public.vip_admin_logs';
    EXECUTE 'CREATE POLICY vip_admin_logs_read ON public.vip_admin_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()))';
    EXECUTE 'DROP POLICY IF EXISTS vip_admin_logs_insert ON public.vip_admin_logs';
    EXECUTE 'CREATE POLICY vip_admin_logs_insert ON public.vip_admin_logs FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()))';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
