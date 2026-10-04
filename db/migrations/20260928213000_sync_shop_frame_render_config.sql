-- Keep Shop Render Studio DP-frame settings consistent everywhere an equipped frame is rendered.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS frame_render_config jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.trg_sync_frame_render_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.render_config IS DISTINCT FROM OLD.render_config THEN
    UPDATE public.profiles
    SET frame_render_config = COALESCE(NEW.render_config, '{}'::jsonb),
        updated_at = now()
    WHERE frame IS NOT NULL
      AND split_part(frame, '#', 1) IN (
        split_part(COALESCE(NEW.animation_url, ''), '#', 1),
        split_part(COALESCE(NEW.preview_url, ''), '#', 1),
        split_part(COALESCE(NEW.bg_image, ''), '#', 1)
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_themes_sync_frame_render_config ON public.themes;
CREATE TRIGGER trg_themes_sync_frame_render_config
AFTER UPDATE OF render_config ON public.themes
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_frame_render_config();

-- Critical: when a user equips/changes a DP frame AFTER its Shop Studio
-- settings were saved, copy the current theme render_config immediately.
-- Previously this only synced when the theme itself was edited, so newly
-- equipped frames could render with an empty/stale config.
CREATE OR REPLACE FUNCTION public.trg_sync_profile_frame_render_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.frame IS DISTINCT FROM OLD.frame THEN
    NEW.frame_render_config := COALESCE((
      SELECT t.render_config
      FROM public.themes t
      WHERE split_part(COALESCE(NEW.frame, ''), '#', 1) IN (
        split_part(COALESCE(t.animation_url, ''), '#', 1),
        split_part(COALESCE(t.preview_url, ''), '#', 1),
        split_part(COALESCE(t.bg_image, ''), '#', 1)
      )
      ORDER BY t.updated_at DESC NULLS LAST
      LIMIT 1
    ), '{}'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_sync_frame_render_config ON public.profiles;
CREATE TRIGGER trg_profiles_sync_frame_render_config
BEFORE INSERT OR UPDATE OF frame ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_profile_frame_render_config();

-- Repair existing equipped frames as well.
UPDATE public.profiles p
SET frame_render_config = COALESCE((
  SELECT t.render_config
  FROM public.themes t
  WHERE split_part(COALESCE(p.frame, ''), '#', 1) IN (
    split_part(COALESCE(t.animation_url, ''), '#', 1),
    split_part(COALESCE(t.preview_url, ''), '#', 1),
    split_part(COALESCE(t.bg_image, ''), '#', 1)
  )
  ORDER BY t.updated_at DESC NULLS LAST
  LIMIT 1
), '{}'::jsonb)
WHERE p.frame IS NOT NULL;
