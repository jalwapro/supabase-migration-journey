-- NEXT 12: atomic published-version rollback for App Studio.
-- Restores an existing published snapshot without modifying business data.

CREATE OR REPLACE FUNCTION public.rollback_app_customization_version(
  p_page_id UUID,
  p_version INTEGER
)
RETURNS public.app_customization_published
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source public.app_customization_published%ROWTYPE;
  v_result public.app_customization_published%ROWTYPE;
BEGIN
  IF NOT public.room_layout_admin() THEN
    RAISE EXCEPTION 'App Studio rollback requires admin authorization';
  END IF;

  SELECT * INTO v_source
  FROM public.app_customization_published
  WHERE page_id = p_page_id
    AND version = p_version
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Published App Studio version % was not found for page %', p_version, p_page_id;
  END IF;

  UPDATE public.app_customization_published
  SET is_current = false
  WHERE page_id = p_page_id
    AND is_current = true;

  INSERT INTO public.app_customization_published (
    page_id,
    version_id,
    config,
    version,
    published_by,
    published_at,
    is_current
  )
  VALUES (
    v_source.page_id,
    v_source.version_id,
    v_source.config,
    v_source.version,
    auth.uid(),
    NOW(),
    true
  )
  ON CONFLICT (page_id, version)
  DO UPDATE SET
    version_id = EXCLUDED.version_id,
    config = EXCLUDED.config,
    published_by = EXCLUDED.published_by,
    published_at = EXCLUDED.published_at,
    is_current = true
  RETURNING * INTO v_result;

  -- Keep the version itself marked as published; the published snapshot is the
  -- runtime source of truth and remains protected by the runtime-read RLS policy.
  UPDATE public.app_customization_versions
  SET status = 'published',
      published_at = COALESCE(published_at, NOW())
  WHERE id = v_result.version_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.rollback_app_customization_version(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rollback_app_customization_version(UUID, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
