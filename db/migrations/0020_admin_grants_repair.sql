-- 0020_admin_grants_repair.sql
-- Fix: "permission denied for table themes" when admin adds/edits items.
-- The base grants only allowed SELECT for authenticated on themes and a few
-- other admin-managed tables. RLS already restricts writes to admins, but
-- Postgres requires the table-level grant too. Add the write grants here.

GRANT INSERT, UPDATE, DELETE ON public.themes           TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_themes      TO authenticated;

-- Safety net: any other public table an admin manages via the app should
-- also have write grants for authenticated (RLS still gates by role).
DO $$
DECLARE
  tbl record;
  has_write boolean;
BEGIN
  FOR tbl IN
    SELECT c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind = 'r' AND n.nspname = 'public'
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.role_table_grants
       WHERE grantee = 'authenticated'
         AND table_schema = 'public'
         AND table_name = tbl.table_name
         AND privilege_type IN ('INSERT','UPDATE','DELETE')
    ) INTO has_write;
    IF NOT has_write THEN
      EXECUTE format(
        'GRANT INSERT, UPDATE, DELETE ON public.%I TO authenticated',
        tbl.table_name
      );
    END IF;

    -- Ensure service_role always has full access.
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl.table_name);
  END LOOP;
END $$;
