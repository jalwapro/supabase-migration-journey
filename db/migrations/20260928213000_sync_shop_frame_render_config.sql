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

UPDATE public.profiles p
SET frame_render_config = COALESCE(t.render_config, '{}'::jsonb)
FROM public.themes t
WHERE p.frame IS NOT NULL
  AND split_part(p.frame, '#', 1) IN (
    split_part(COALESCE(t.animation_url, ''), '#', 1),
    split_part(COALESCE(t.preview_url, ''), '#', 1),
    split_part(COALESCE(t.bg_image, ''), '#', 1)
  );
