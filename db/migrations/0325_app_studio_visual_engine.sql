-- JALWA APP STUDIO VISUAL ENGINE
-- Presentation-only metadata. Existing business logic is untouched.

CREATE TABLE IF NOT EXISTS public.app_studio_popups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  popup_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  popup_type TEXT NOT NULL DEFAULT 'modal',
  route_pattern TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  responsive JSONB NOT NULL DEFAULT '{}'::jsonb,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_studio_design_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_key TEXT NOT NULL DEFAULT 'jalwa',
  name TEXT NOT NULL DEFAULT 'Default',
  tokens JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_key, name, version)
);

CREATE TABLE IF NOT EXISTS public.app_studio_text_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_key TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  value TEXT NOT NULL,
  page_key TEXT,
  component_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(content_key, locale, page_key, component_id, status)
);

CREATE TABLE IF NOT EXISTS public.app_studio_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES public.app_customization_pages(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'snapshot' CHECK (status IN ('snapshot','published','rollback')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_summary TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(page_id, version)
);

CREATE INDEX IF NOT EXISTS idx_app_studio_popups_type ON public.app_studio_popups(popup_type);
CREATE INDEX IF NOT EXISTS idx_app_studio_text_overrides_lookup ON public.app_studio_text_overrides(content_key, locale, status);
CREATE INDEX IF NOT EXISTS idx_app_studio_versions_page ON public.app_studio_versions(page_id, version DESC);

ALTER TABLE public.app_studio_popups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_studio_design_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_studio_text_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_studio_versions ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['app_studio_popups','app_studio_design_tokens','app_studio_text_overrides','app_studio_versions'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.room_layout_admin()) WITH CHECK (public.room_layout_admin())', t || '_admin_all', t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'update_' || t || '_updated_at', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_app_customization_updated_at()', 'update_' || t || '_updated_at', t);
  END LOOP;
END $$;

-- Additive metadata columns to the existing version store.
ALTER TABLE public.app_customization_versions ADD COLUMN IF NOT EXISTS validation JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.app_customization_versions ADD COLUMN IF NOT EXISTS device_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.app_customization_versions ADD COLUMN IF NOT EXISTS change_summary TEXT;

-- Safe compatibility fields on pages for Studio-level settings.
ALTER TABLE public.app_customization_pages ADD COLUMN IF NOT EXISTS studio_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.app_customization_pages ADD COLUMN IF NOT EXISTS responsive_config JSONB NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
