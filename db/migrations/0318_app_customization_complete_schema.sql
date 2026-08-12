-- APP CUSTOMIZATION COMPLETE SCHEMA
-- Admin customization storage only. This migration does not alter user-facing business logic.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Canonical pages table (0316 also creates this; IF NOT EXISTS makes this safe to run).
CREATE TABLE IF NOT EXISTS public.app_customization_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  route_pattern TEXT NOT NULL,
  page_type TEXT NOT NULL DEFAULT 'app',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','draft','archived')),
  is_system BOOLEAN NOT NULL DEFAULT true,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  is_home BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns that may be missing when 0316 already existed.
ALTER TABLE public.app_customization_pages ADD COLUMN IF NOT EXISTS page_type TEXT NOT NULL DEFAULT 'app';
ALTER TABLE public.app_customization_pages ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.app_customization_pages ADD COLUMN IF NOT EXISTS configuration JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.app_customization_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.app_customization_pages(id) ON DELETE CASCADE,
  parent_section_id UUID REFERENCES public.app_customization_sections(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  name TEXT NOT NULL,
  section_type TEXT NOT NULL DEFAULT 'section',
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  locked BOOLEAN NOT NULL DEFAULT false,
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  styles JSONB NOT NULL DEFAULT '{}'::jsonb,
  responsive JSONB NOT NULL DEFAULT '{}'::jsonb,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(page_id, section_key)
);

CREATE TABLE IF NOT EXISTS public.app_customization_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.app_customization_sections(id) ON DELETE CASCADE,
  component_key TEXT NOT NULL,
  component_type TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  locked BOOLEAN NOT NULL DEFAULT false,
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  styles JSONB NOT NULL DEFAULT '{}'::jsonb,
  responsive JSONB NOT NULL DEFAULT '{}'::jsonb,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(section_id, component_key)
);

CREATE TABLE IF NOT EXISTS public.app_customization_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','draft','archived')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_customization_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'images',
  storage_path TEXT,
  public_url TEXT,
  mime_type TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_customization_navigation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES public.app_customization_pages(id) ON DELETE CASCADE,
  navigation_key TEXT NOT NULL,
  label TEXT NOT NULL,
  icon TEXT,
  route TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(navigation_key)
);

CREATE TABLE IF NOT EXISTS public.app_customization_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES public.app_customization_pages(id) ON DELETE CASCADE,
  layout_key TEXT NOT NULL,
  layout_type TEXT NOT NULL DEFAULT 'page',
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  responsive JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(layout_key, version)
);

CREATE TABLE IF NOT EXISTS public.app_customization_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.app_customization_pages(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','scheduled','archived')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  UNIQUE(page_id, version)
);

CREATE TABLE IF NOT EXISTS public.app_customization_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.app_customization_pages(id) ON DELETE CASCADE,
  version_id UUID REFERENCES public.app_customization_versions(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Draft',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','preview','archived')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_customization_published (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.app_customization_pages(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.app_customization_versions(id) ON DELETE RESTRICT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL,
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_current BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(page_id, version)
);

-- Indexes / lookup paths.
CREATE INDEX IF NOT EXISTS idx_app_customization_pages_order ON public.app_customization_pages(sort_order);
CREATE INDEX IF NOT EXISTS idx_app_customization_sections_page_order ON public.app_customization_sections(page_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_app_customization_components_section_order ON public.app_customization_components(section_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_app_customization_navigation_page_order ON public.app_customization_navigation(page_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_app_customization_layouts_page ON public.app_customization_layouts(page_id, layout_key, version DESC);
CREATE INDEX IF NOT EXISTS idx_app_customization_versions_page_status ON public.app_customization_versions(page_id, status, version DESC);
CREATE INDEX IF NOT EXISTS idx_app_customization_drafts_page ON public.app_customization_drafts(page_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_customization_published_current ON public.app_customization_published(page_id) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_app_customization_assets_category ON public.app_customization_assets(category);

-- Only one published version can be current per page.
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_customization_published_current
  ON public.app_customization_published(page_id) WHERE is_current = true;

CREATE OR REPLACE FUNCTION public.update_app_customization_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'app_customization_pages','app_customization_sections','app_customization_components',
    'app_customization_themes','app_customization_assets','app_customization_navigation',
    'app_customization_layouts','app_customization_drafts'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'update_' || t || '_updated_at', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_app_customization_updated_at()', 'update_' || t || '_updated_at', t);
  END LOOP;
END $$;

-- RLS: customization is readable only to authenticated admins and writable only by the existing admin role helper.
ALTER TABLE public.app_customization_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_customization_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_customization_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_customization_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_customization_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_customization_navigation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_customization_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_customization_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_customization_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_customization_published ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'app_customization_pages','app_customization_sections','app_customization_components',
    'app_customization_themes','app_customization_assets','app_customization_navigation',
    'app_customization_layouts','app_customization_versions','app_customization_drafts',
    'app_customization_published'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.room_layout_admin()) WITH CHECK (public.room_layout_admin())', t || '_admin_all', t);
  END LOOP;
END $$;

-- Seed/repair the standard pages without overwriting existing configuration.
INSERT INTO public.app_customization_pages (page_key, name, description, route_pattern, page_type, is_system, is_enabled, is_home, sort_order)
VALUES
('home','Home','Main home surface','/', 'app', true, true, true, 10),
('discover','Discover','Discover content','/discover', 'app', true, true, false, 20),
('live','Live','Live discovery','/live', 'app', true, true, false, 30),
('rooms','Rooms','Live room discovery','/rooms', 'app', true, true, false, 40),
('voice-room','Voice Room','Voice room presentation','/room/:roomId', 'room', true, true, false, 50),
('video-room','Video Room','Video room presentation','/room/:roomId', 'room', true, true, false, 60),
('pk-battle','PK Battle','PK battle presentation','/pk/:roomId', 'room', true, true, false, 70),
('profile','Profile','User profile','/profile/:userId', 'app', true, true, false, 80),
('wallet','Wallet','Coins and recharge presentation','/wallet', 'app', true, true, false, 90),
('recharge','Recharge','Recharge presentation','/recharge', 'app', true, true, false, 100),
('gifts','Gifts','Gift presentation surfaces','/gifts', 'app', true, true, false, 110),
('ranking','Ranking','Ranking and leaderboard','/ranking', 'app', true, true, false, 120),
('chat','Chat','Chat presentation','/chat', 'app', true, true, false, 130),
('messages','Messages','Messages presentation','/messages', 'app', true, true, false, 140),
('notifications','Notifications','Notification list','/notifications', 'app', true, true, false, 150),
('settings','Settings','User settings','/settings', 'app', true, true, false, 160),
('login','Login','Authentication entry','/login', 'auth', true, true, false, 170),
('register','Register','Registration entry','/register', 'auth', true, true, false, 180),
('splash','Splash','Launch surface','/splash', 'auth', true, true, false, 190)
ON CONFLICT (page_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = COALESCE(public.app_customization_pages.description, EXCLUDED.description),
  route_pattern = EXCLUDED.route_pattern,
  page_type = EXCLUDED.page_type,
  updated_at = NOW();

-- Ensure every page has a first draft version without overwriting existing drafts.
INSERT INTO public.app_customization_versions (page_id, version, status, config)
SELECT p.id, 1, 'draft', jsonb_build_object(
  'schemaVersion', 1,
  'sections', '[]'::jsonb,
  'theme', '{}',
  'navigation', '{}',
  'responsive', jsonb_build_object('mobile','{}','tablet','{}','desktop','{}')
)
FROM public.app_customization_pages p
WHERE NOT EXISTS (SELECT 1 FROM public.app_customization_versions v WHERE v.page_id = p.id);

NOTIFY pgrst, 'reload schema';
