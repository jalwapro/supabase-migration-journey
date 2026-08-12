-- ADMIN CUSTOMIZATION ONLY
-- This migration adds configuration storage for the Admin Panel visual builder.
-- It does NOT alter or connect to any user-facing application route/component/business table.

CREATE TABLE IF NOT EXISTS public.app_customization_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.app_customization_pages(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(page_id, section_key)
);

CREATE TABLE IF NOT EXISTS public.app_customization_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.app_customization_pages(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.app_customization_sections(id) ON DELETE CASCADE,
  component_key TEXT NOT NULL,
  component_type TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  responsive JSONB NOT NULL DEFAULT '{}'::jsonb,
  visibility_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(page_id, component_key)
);

CREATE TABLE IF NOT EXISTS public.app_customization_navigation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES public.app_customization_pages(id) ON DELETE CASCADE,
  navigation_key TEXT NOT NULL,
  name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(page_id, navigation_key)
);

CREATE TABLE IF NOT EXISTS public.app_customization_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES public.app_customization_pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  layout_type TEXT NOT NULL DEFAULT 'page',
  device TEXT NOT NULL DEFAULT 'mobile' CHECK (device IN ('mobile','tablet','desktop','all')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_customization_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.app_customization_pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Draft',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  based_on_version INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_customization_published (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL UNIQUE REFERENCES public.app_customization_pages(id) ON DELETE CASCADE,
  version_id UUID REFERENCES public.app_customization_versions(id) ON DELETE SET NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_app_customization_sections_page_order
  ON public.app_customization_sections(page_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_app_customization_components_page_order
  ON public.app_customization_components(page_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_app_customization_components_section_order
  ON public.app_customization_components(section_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_app_customization_navigation_page
  ON public.app_customization_navigation(page_id);
CREATE INDEX IF NOT EXISTS idx_app_customization_layouts_page
  ON public.app_customization_layouts(page_id);
CREATE INDEX IF NOT EXISTS idx_app_customization_drafts_page_active
  ON public.app_customization_drafts(page_id, is_active, updated_at DESC);

CREATE OR REPLACE FUNCTION public.update_app_customization_workspace_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS update_app_customization_sections_updated_at ON public.app_customization_sections;
CREATE TRIGGER update_app_customization_sections_updated_at
BEFORE UPDATE ON public.app_customization_sections FOR EACH ROW
EXECUTE FUNCTION public.update_app_customization_workspace_updated_at();

DROP TRIGGER IF EXISTS update_app_customization_components_updated_at ON public.app_customization_components;
CREATE TRIGGER update_app_customization_components_updated_at
BEFORE UPDATE ON public.app_customization_components FOR EACH ROW
EXECUTE FUNCTION public.update_app_customization_workspace_updated_at();

DROP TRIGGER IF EXISTS update_app_customization_navigation_updated_at ON public.app_customization_navigation;
CREATE TRIGGER update_app_customization_navigation_updated_at
BEFORE UPDATE ON public.app_customization_navigation FOR EACH ROW
EXECUTE FUNCTION public.update_app_customization_workspace_updated_at();

DROP TRIGGER IF EXISTS update_app_customization_layouts_updated_at ON public.app_customization_layouts;
CREATE TRIGGER update_app_customization_layouts_updated_at
BEFORE UPDATE ON public.app_customization_layouts FOR EACH ROW
EXECUTE FUNCTION public.update_app_customization_workspace_updated_at();

DROP TRIGGER IF EXISTS update_app_customization_drafts_updated_at ON public.app_customization_drafts;
CREATE TRIGGER update_app_customization_drafts_updated_at
BEFORE UPDATE ON public.app_customization_drafts FOR EACH ROW
EXECUTE FUNCTION public.update_app_customization_workspace_updated_at();

ALTER TABLE public.app_customization_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_customization_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_customization_navigation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_customization_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_customization_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_customization_published ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_customization_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_customization_components TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_customization_navigation TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_customization_layouts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_customization_drafts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_customization_published TO authenticated;

DROP POLICY IF EXISTS "Customization sections admin only" ON public.app_customization_sections;
CREATE POLICY "Customization sections admin only" ON public.app_customization_sections
FOR ALL TO authenticated USING (public.room_layout_admin()) WITH CHECK (public.room_layout_admin());

DROP POLICY IF EXISTS "Customization components admin only" ON public.app_customization_components;
CREATE POLICY "Customization components admin only" ON public.app_customization_components
FOR ALL TO authenticated USING (public.room_layout_admin()) WITH CHECK (public.room_layout_admin());

DROP POLICY IF EXISTS "Customization navigation admin only" ON public.app_customization_navigation;
CREATE POLICY "Customization navigation admin only" ON public.app_customization_navigation
FOR ALL TO authenticated USING (public.room_layout_admin()) WITH CHECK (public.room_layout_admin());

DROP POLICY IF EXISTS "Customization layouts admin only" ON public.app_customization_layouts;
CREATE POLICY "Customization layouts admin only" ON public.app_customization_layouts
FOR ALL TO authenticated USING (public.room_layout_admin()) WITH CHECK (public.room_layout_admin());

DROP POLICY IF EXISTS "Customization drafts admin only" ON public.app_customization_drafts;
CREATE POLICY "Customization drafts admin only" ON public.app_customization_drafts
FOR ALL TO authenticated USING (public.room_layout_admin()) WITH CHECK (public.room_layout_admin());

DROP POLICY IF EXISTS "Customization published admin only" ON public.app_customization_published;
CREATE POLICY "Customization published admin only" ON public.app_customization_published
FOR ALL TO authenticated USING (public.room_layout_admin()) WITH CHECK (public.room_layout_admin());

NOTIFY pgrst, 'reload schema';
