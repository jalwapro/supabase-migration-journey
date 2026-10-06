-- Keep App Studio publish draft and publication in one transaction.
CREATE OR REPLACE FUNCTION public.publish_app_customization(
  p_page_id UUID,
  p_config JSONB
)
RETURNS public.app_customization_published
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version INTEGER;
  v_version_row public.app_customization_versions%ROWTYPE;
  v_published public.app_customization_published%ROWTYPE;
BEGIN
  IF NOT public.room_layout_admin() THEN
    RAISE EXCEPTION 'App Studio requires admin authorization';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_page_id::text));

  -- Keep the editor's draft synchronized with the exact config being published,
  -- while holding the same transaction/advisory lock.
  UPDATE public.app_customization_versions
  SET config = p_config, created_by = auth.uid()
  WHERE id = (
    SELECT id
    FROM public.app_customization_versions
    WHERE page_id = p_page_id AND status = 'draft'
    ORDER BY version DESC
    LIMIT 1
    FOR UPDATE
  );

  IF NOT FOUND THEN
    SELECT COALESCE(MAX(version),0) + 1 INTO v_version
    FROM public.app_customization_versions
    WHERE page_id = p_page_id;

    INSERT INTO public.app_customization_versions(page_id, version, status, config, created_by)
    VALUES(p_page_id, v_version, 'draft', p_config, auth.uid());
  END IF;

  SELECT COALESCE(MAX(version),0) + 1 INTO v_version
  FROM public.app_customization_versions
  WHERE page_id = p_page_id;

  INSERT INTO public.app_customization_versions(
    page_id, version, status, config, created_by, published_at
  )
  VALUES(p_page_id, v_version, 'published', p_config, auth.uid(), NOW())
  RETURNING * INTO v_version_row;

  UPDATE public.app_customization_published
  SET is_current = false
  WHERE page_id = p_page_id AND is_current = true;

  INSERT INTO public.app_customization_published(
    page_id, version_id, config, version, published_by, published_at, is_current
  )
  VALUES(
    p_page_id, v_version_row.id, p_config, v_version, auth.uid(), NOW(), true
  )
  RETURNING * INTO v_published;

  RETURN v_published;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_app_customization(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_app_customization(UUID, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
