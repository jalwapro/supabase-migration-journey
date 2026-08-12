-- APP CUSTOMIZATION STUDIO
-- Presentation configuration only. Existing business logic remains authoritative.

CREATE TABLE IF NOT EXISTS public.app_customization_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  route_pattern TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT true,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  is_home BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

CREATE TABLE IF NOT EXISTS public.app_customization_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_customization_versions_page_status
  ON public.app_customization_versions(page_id, status, version DESC);
CREATE INDEX IF NOT EXISTS idx_app_customization_pages_order
  ON public.app_customization_pages(sort_order);
CREATE INDEX IF NOT EXISTS idx_app_customization_assets_category
  ON public.app_customization_assets(category);

CREATE OR REPLACE FUNCTION public.update_app_customization_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS update_app_customization_pages_updated_at ON public.app_customization_pages;
CREATE TRIGGER update_app_customization_pages_updated_at
BEFORE UPDATE ON public.app_customization_pages FOR EACH ROW
EXECUTE FUNCTION public.update_app_customization_updated_at();

DROP TRIGGER IF EXISTS update_app_customization_assets_updated_at ON public.app_customization_assets;
CREATE TRIGGER update_app_customization_assets_updated_at
BEFORE UPDATE ON public.app_customization_assets FOR EACH ROW
EXECUTE FUNCTION public.update_app_customization_updated_at();

DROP TRIGGER IF EXISTS update_app_customization_themes_updated_at ON public.app_customization_themes;
CREATE TRIGGER update_app_customization_themes_updated_at
BEFORE UPDATE ON public.app_customization_themes FOR EACH ROW
EXECUTE FUNCTION public.update_app_customization_updated_at();

ALTER TABLE public.app_customization_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_customization_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_customization_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_customization_themes ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.app_customization_pages TO authenticated;
GRANT SELECT ON public.app_customization_versions TO authenticated;
GRANT SELECT ON public.app_customization_assets TO authenticated;
GRANT SELECT ON public.app_customization_themes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_customization_pages TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_customization_versions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_customization_assets TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_customization_themes TO authenticated;

DROP POLICY IF EXISTS "App customization pages read" ON public.app_customization_pages;
CREATE POLICY "App customization pages read" ON public.app_customization_pages
FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "App customization pages admin write" ON public.app_customization_pages;
CREATE POLICY "App customization pages admin write" ON public.app_customization_pages
FOR ALL TO authenticated USING (public.room_layout_admin()) WITH CHECK (public.room_layout_admin());

DROP POLICY IF EXISTS "App customization versions read" ON public.app_customization_versions;
CREATE POLICY "App customization versions read" ON public.app_customization_versions
FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "App customization versions admin write" ON public.app_customization_versions;
CREATE POLICY "App customization versions admin write" ON public.app_customization_versions
FOR ALL TO authenticated USING (public.room_layout_admin()) WITH CHECK (public.room_layout_admin());

DROP POLICY IF EXISTS "App customization assets read" ON public.app_customization_assets;
CREATE POLICY "App customization assets read" ON public.app_customization_assets
FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "App customization assets admin write" ON public.app_customization_assets;
CREATE POLICY "App customization assets admin write" ON public.app_customization_assets
FOR ALL TO authenticated USING (public.room_layout_admin()) WITH CHECK (public.room_layout_admin());

DROP POLICY IF EXISTS "App customization themes read" ON public.app_customization_themes;
CREATE POLICY "App customization themes read" ON public.app_customization_themes
FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "App customization themes admin write" ON public.app_customization_themes;
CREATE POLICY "App customization themes admin write" ON public.app_customization_themes
FOR ALL TO authenticated USING (public.room_layout_admin()) WITH CHECK (public.room_layout_admin());

INSERT INTO public.app_customization_pages (page_key, name, description, route_pattern, is_system, sort_order)
VALUES
('home','Home','Main user home/discover surface','/',true,10),
('rooms','Rooms','Live room discovery','/rooms',true,20),
('voice-room','Voice Room','Voice room presentation','/room/:roomId',true,30),
('video-room','Video Room','Video room presentation','/room/:roomId',true,40),
('pk-battle','PK Battle','PK battle presentation','/pk/:roomId',true,50),
('profile','Profile','User profile','/profile/:userId',true,60),
('wallet','Wallet','Coins, diamonds and recharge UI','/wallet',true,70),
('messages','Messages','Message list and chat entry','/messages',true,80),
('ranking','Ranking','Ranking and leaderboard UI','/ranking',true,90),
('gifts','Gifts','Gift presentation surfaces','/gifts',true,100),
('notifications','Notifications','Notification list','/notifications',true,110),
('settings','Settings','User settings','/settings',true,120),
('login','Login','Authentication entry','/login',true,130),
('register','Register','Registration entry','/register',true,140),
('splash','Splash','Splash/launch surface','/splash',true,150)
ON CONFLICT (page_key) DO NOTHING;

INSERT INTO public.app_customization_versions (page_id, version, status, config)
SELECT id, 1, 'draft', jsonb_build_object(
  'schemaVersion', 1,
  'theme', 'default',
  'sections', '[]'::jsonb,
  'navigation', '{}'::jsonb,
  'responsive', jsonb_build_object('mobile', '{}', 'tablet', '{}', 'desktop', '{}')
)
FROM public.app_customization_pages p
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_customization_versions v WHERE v.page_id = p.id
);

NOTIFY pgrst, 'reload schema';
