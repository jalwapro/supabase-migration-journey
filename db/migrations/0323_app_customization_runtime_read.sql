-- Allow the published, non-sensitive visual configuration to be read by the app runtime.
-- Drafts, versions and authoring tables remain admin-only.
ALTER TABLE public.app_customization_published ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.app_customization_published TO anon, authenticated;
DROP POLICY IF EXISTS "App customization published runtime read" ON public.app_customization_published;
CREATE POLICY "App customization published runtime read"
  ON public.app_customization_published
  FOR SELECT TO anon, authenticated
  USING (is_current = true);

ALTER TABLE public.app_customization_pages ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.app_customization_pages TO anon, authenticated;
DROP POLICY IF EXISTS "App customization pages runtime read" ON public.app_customization_pages;
CREATE POLICY "App customization pages runtime read"
  ON public.app_customization_pages
  FOR SELECT TO anon, authenticated
  USING (is_enabled = true);

NOTIFY pgrst, 'reload schema';
