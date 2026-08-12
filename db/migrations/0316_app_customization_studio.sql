-- Central Wix-style app customization configuration.
CREATE TABLE IF NOT EXISTS public.app_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Main App',
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.app_customization_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customization_id UUID NOT NULL REFERENCES public.app_customizations(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customization_id, version)
);

ALTER TABLE public.app_customizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_customization_versions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_customizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_customization_versions TO authenticated;

DROP POLICY IF EXISTS "App customization authenticated read" ON public.app_customizations;
CREATE POLICY "App customization authenticated read" ON public.app_customizations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "App customization admin write" ON public.app_customizations;
CREATE POLICY "App customization admin write" ON public.app_customizations FOR INSERT TO authenticated WITH CHECK (public.room_layout_admin());
CREATE POLICY "App customization admin update" ON public.app_customizations FOR UPDATE TO authenticated USING (public.room_layout_admin()) WITH CHECK (public.room_layout_admin());
CREATE POLICY "App customization admin delete" ON public.app_customizations FOR DELETE TO authenticated USING (public.room_layout_admin());

DROP POLICY IF EXISTS "App customization versions authenticated read" ON public.app_customization_versions;
CREATE POLICY "App customization versions authenticated read" ON public.app_customization_versions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "App customization versions admin write" ON public.app_customization_versions;
CREATE POLICY "App customization versions admin write" ON public.app_customization_versions FOR ALL TO authenticated USING (public.room_layout_admin()) WITH CHECK (public.room_layout_admin());

-- Returns only the currently published configuration for the user-facing app.
CREATE OR REPLACE FUNCTION public.get_published_app_customization()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT config_json
    FROM public.app_customizations
    WHERE status = 'published'
    ORDER BY published_at DESC NULLS LAST, updated_at DESC
    LIMIT 1
  ), '{}'::jsonb);
$$;

GRANT EXECUTE ON FUNCTION public.get_published_app_customization() TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
