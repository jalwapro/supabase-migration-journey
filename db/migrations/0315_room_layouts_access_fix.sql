-- Room Layout Studio access fix
-- Ensures the layout tables exist, are readable by authenticated admin-panel users,
-- and remain protected for mutations.

CREATE TABLE IF NOT EXISTS public.room_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('voice', 'video', 'pk')),
  description TEXT,
  layout_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.room_layout_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id UUID NOT NULL REFERENCES public.room_layouts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  layout_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail TEXT,
  change_description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(layout_id, version)
);

CREATE TABLE IF NOT EXISTS public.room_layout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('voice', 'video', 'pk')),
  description TEXT,
  layout_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.room_layout_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  layout_id UUID REFERENCES public.room_layouts(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(room_id)
);

CREATE TABLE IF NOT EXISTS public.category_layout_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('voice', 'video', 'pk')),
  layout_id UUID REFERENCES public.room_layouts(id) ON DELETE SET NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(category, type)
);

CREATE INDEX IF NOT EXISTS idx_room_layouts_type ON public.room_layouts(type);
CREATE INDEX IF NOT EXISTS idx_room_layouts_status ON public.room_layouts(status);
CREATE INDEX IF NOT EXISTS idx_room_layouts_updated_at ON public.room_layouts(updated_at DESC);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_layouts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_layout_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_layout_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_layout_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_layout_assignments TO authenticated;

-- Keep reads working for authenticated admin-panel users. The admin route itself
-- already requires the authenticated/admin application shell. Mutations remain
-- protected by the admin-role checks below.
ALTER TABLE public.room_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_layout_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_layout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_layout_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_layout_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Room layouts authenticated read" ON public.room_layouts;
CREATE POLICY "Room layouts authenticated read"
ON public.room_layouts FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Room layout versions authenticated read" ON public.room_layout_versions;
CREATE POLICY "Room layout versions authenticated read"
ON public.room_layout_versions FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Room layout templates authenticated read" ON public.room_layout_templates;
CREATE POLICY "Room layout templates authenticated read"
ON public.room_layout_templates FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Room layout assignments authenticated read" ON public.room_layout_assignments;
CREATE POLICY "Room layout assignments authenticated read"
ON public.room_layout_assignments FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Category layout assignments authenticated read" ON public.category_layout_assignments;
CREATE POLICY "Category layout assignments authenticated read"
ON public.category_layout_assignments FOR SELECT TO authenticated
USING (true);

-- Admin mutation check that does not depend on a project-specific is_admin()
-- helper existing in the database. Supports the common Supabase JWT locations.
CREATE OR REPLACE FUNCTION public.room_layout_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin'),
    auth.jwt() -> 'user_metadata' ->> 'role' IN ('admin', 'super_admin'),
    auth.jwt() ->> 'role' IN ('admin', 'super_admin')
  );
$$;

DROP POLICY IF EXISTS "Room layouts admin insert" ON public.room_layouts;
CREATE POLICY "Room layouts admin insert" ON public.room_layouts FOR INSERT TO authenticated
WITH CHECK (public.room_layout_admin());
DROP POLICY IF EXISTS "Room layouts admin update" ON public.room_layouts;
CREATE POLICY "Room layouts admin update" ON public.room_layouts FOR UPDATE TO authenticated
USING (public.room_layout_admin()) WITH CHECK (public.room_layout_admin());
DROP POLICY IF EXISTS "Room layouts admin delete" ON public.room_layouts;
CREATE POLICY "Room layouts admin delete" ON public.room_layouts FOR DELETE TO authenticated
USING (public.room_layout_admin());

DROP POLICY IF EXISTS "Room layout versions admin write" ON public.room_layout_versions;
CREATE POLICY "Room layout versions admin write" ON public.room_layout_versions FOR ALL TO authenticated
USING (public.room_layout_admin()) WITH CHECK (public.room_layout_admin());
DROP POLICY IF EXISTS "Room layout templates admin write" ON public.room_layout_templates;
CREATE POLICY "Room layout templates admin write" ON public.room_layout_templates FOR ALL TO authenticated
USING (public.room_layout_admin()) WITH CHECK (public.room_layout_admin());
DROP POLICY IF EXISTS "Room layout assignments admin write" ON public.room_layout_assignments;
CREATE POLICY "Room layout assignments admin write" ON public.room_layout_assignments FOR ALL TO authenticated
USING (public.room_layout_admin()) WITH CHECK (public.room_layout_admin());
DROP POLICY IF EXISTS "Category layout assignments admin write" ON public.category_layout_assignments;
CREATE POLICY "Category layout assignments admin write" ON public.category_layout_assignments FOR ALL TO authenticated
USING (public.room_layout_admin()) WITH CHECK (public.room_layout_admin());

-- Runtime resolver: room -> category -> default.
CREATE OR REPLACE FUNCTION public.get_room_layout(p_room_id UUID, p_type TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_layout JSONB;
  v_category TEXT;
BEGIN
  SELECT rl.layout_json INTO v_layout
  FROM public.room_layout_assignments rla
  JOIN public.room_layouts rl ON rl.id = rla.layout_id
  WHERE rla.room_id = p_room_id AND rl.type = p_type AND rl.status = 'published'
  LIMIT 1;

  IF v_layout IS NULL THEN
    SELECT lr.category INTO v_category
    FROM public.live_rooms lr
    WHERE lr.id = p_room_id
    LIMIT 1;

    IF v_category IS NOT NULL THEN
      SELECT rl.layout_json INTO v_layout
      FROM public.category_layout_assignments cla
      JOIN public.room_layouts rl ON rl.id = cla.layout_id
      WHERE cla.category = v_category AND cla.type = p_type AND rl.status = 'published'
      ORDER BY cla.priority DESC
      LIMIT 1;
    END IF;
  END IF;

  IF v_layout IS NULL THEN
    SELECT rl.layout_json INTO v_layout
    FROM public.room_layouts rl
    WHERE rl.type = p_type AND rl.is_default = true AND rl.status = 'published'
    ORDER BY rl.updated_at DESC
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_layout, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_room_layout(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.room_layout_admin() TO authenticated;

NOTIFY pgrst, 'reload schema';
