-- ROOM LAYOUTS: security, correctness and publish/runtime hardening

CREATE OR REPLACE FUNCTION public.get_room_layout(p_room_id UUID, p_type TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_layout JSONB;
  v_category TEXT;
BEGIN
  SELECT rl.layout_json INTO v_layout
  FROM public.room_layout_assignments rla
  JOIN public.room_layouts rl ON rla.layout_id = rl.id
  WHERE rla.room_id = p_room_id AND rl.type = p_type AND rl.status = 'published' LIMIT 1;

  IF v_layout IS NULL THEN
    SELECT lr.category INTO v_category FROM public.live_rooms lr WHERE lr.id = p_room_id LIMIT 1;
    IF v_category IS NOT NULL THEN
      SELECT rl.layout_json INTO v_layout
      FROM public.category_layout_assignments cla
      JOIN public.room_layouts rl ON cla.layout_id = rl.id
      WHERE cla.category = v_category AND cla.type = p_type AND rl.status = 'published'
      ORDER BY cla.priority DESC LIMIT 1;
    END IF;
  END IF;

  IF v_layout IS NULL THEN
    SELECT rl.layout_json INTO v_layout FROM public.room_layouts rl
    WHERE rl.type = p_type AND rl.is_default = true AND rl.status = 'published'
    ORDER BY rl.updated_at DESC LIMIT 1;
  END IF;

  RETURN COALESCE(v_layout, '{}'::jsonb);
END;
$$;

ALTER TABLE public.room_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_layout_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_layout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_layout_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_layout_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage room layouts" ON public.room_layouts;
CREATE POLICY "Admins manage room layouts" ON public.room_layouts FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins manage room layout versions" ON public.room_layout_versions;
CREATE POLICY "Admins manage room layout versions" ON public.room_layout_versions FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins manage room layout templates" ON public.room_layout_templates;
CREATE POLICY "Admins manage room layout templates" ON public.room_layout_templates FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins manage room layout assignments" ON public.room_layout_assignments;
CREATE POLICY "Admins manage room layout assignments" ON public.room_layout_assignments FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins manage category layout assignments" ON public.category_layout_assignments;
CREATE POLICY "Admins manage category layout assignments" ON public.category_layout_assignments FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

REVOKE EXECUTE ON FUNCTION public.get_room_layout(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_room_layout(UUID, TEXT) TO authenticated;

WITH ranked_defaults AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY type ORDER BY updated_at DESC, created_at DESC, id DESC) AS rn
  FROM public.room_layouts
  WHERE is_default = true
)
UPDATE public.room_layouts rl
SET is_default = false
FROM ranked_defaults rd
WHERE rl.id = rd.id AND rd.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_room_layouts_one_default_per_type ON public.room_layouts(type) WHERE is_default = true;

CREATE OR REPLACE FUNCTION public.sync_room_layout_publish_state() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN NEW.published_at = NOW();
  ELSIF NEW.status <> 'published' THEN NEW.published_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sync_room_layout_publish_state ON public.room_layouts;
CREATE TRIGGER sync_room_layout_publish_state BEFORE INSERT OR UPDATE ON public.room_layouts FOR EACH ROW EXECUTE FUNCTION public.sync_room_layout_publish_state();
