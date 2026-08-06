-- Advanced Gift Rendering & Video Editing System
-- Per-gift render/VFX configuration, fully admin-controlled (no code changes).

ALTER TABLE public.gifts
  ADD COLUMN IF NOT EXISTS render_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Reusable named presets the admin can apply/copy across gifts.
CREATE TABLE IF NOT EXISTS public.gift_render_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.gift_render_presets TO authenticated;
GRANT SELECT ON public.gift_render_presets TO anon;
GRANT ALL ON public.gift_render_presets TO service_role;

ALTER TABLE public.gift_render_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presets readable" ON public.gift_render_presets;
CREATE POLICY "presets readable" ON public.gift_render_presets
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "admins manage presets" ON public.gift_render_presets;
CREATE POLICY "admins manage presets" ON public.gift_render_presets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Denormalize onto gift_sends so viewers get the exact render settings
-- with the realtime event, zero extra queries.
ALTER TABLE public.gift_sends
  ADD COLUMN IF NOT EXISTS gift_render_config jsonb;

CREATE OR REPLACE FUNCTION public.gift_sends_fill_denorm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_username IS NULL AND NEW.sender_id IS NOT NULL THEN
    SELECT username, avatar
      INTO NEW.sender_username, NEW.sender_avatar
      FROM public.profiles WHERE id = NEW.sender_id;
  END IF;
  IF NEW.receiver_username IS NULL AND NEW.receiver_id IS NOT NULL THEN
    SELECT username, avatar
      INTO NEW.receiver_username, NEW.receiver_avatar
      FROM public.profiles WHERE id = NEW.receiver_id;
  END IF;
  IF NEW.gift_id IS NOT NULL THEN
    SELECT name, emoji, icon, animation, clip_path, clip_type, image_url,
           COALESCE(audio_url, sound_url), chromakey,
           COALESCE(audio_url, sound_url), priority, duration_ms, loop, audio_volume,
           render_config
      INTO NEW.gift_name, NEW.gift_emoji, NEW.gift_icon, NEW.gift_animation,
           NEW.gift_clip_path, NEW.gift_clip_type, NEW.gift_image_url,
           NEW.gift_sound_url, NEW.gift_chromakey,
           NEW.gift_audio_url, NEW.gift_priority, NEW.gift_duration_ms,
           NEW.gift_loop, NEW.gift_audio_volume,
           NEW.gift_render_config
      FROM public.gifts WHERE id = NEW.gift_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Backfill recent rows so replays match the current settings.
UPDATE public.gift_sends s
   SET gift_render_config = g.render_config
  FROM public.gifts g
 WHERE g.id = s.gift_id
   AND s.created_at > now() - interval '7 days';

NOTIFY pgrst, 'reload schema';
