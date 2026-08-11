-- Admin-controlled per-gift audio: snapshot `audio_enabled` onto gift_sends so
-- every viewer honours the admin's mute setting at playback time.

ALTER TABLE public.gift_sends
  ADD COLUMN IF NOT EXISTS gift_audio_enabled boolean;

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
           COALESCE(audio_url, sound_url), priority, duration_ms, loop,
           audio_volume, audio_enabled
      INTO NEW.gift_name, NEW.gift_emoji, NEW.gift_icon, NEW.gift_animation,
           NEW.gift_clip_path, NEW.gift_clip_type, NEW.gift_image_url,
           NEW.gift_sound_url, NEW.gift_audio_url, NEW.gift_priority, NEW.gift_duration_ms,
           NEW.gift_loop, NEW.gift_audio_volume, NEW.gift_audio_enabled
      FROM public.gifts WHERE id = NEW.gift_id;
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.gift_sends s
   SET gift_audio_enabled = g.audio_enabled,
       gift_audio_volume = g.audio_volume
  FROM public.gifts g
 WHERE g.id = s.gift_id
   AND s.created_at > now() - interval '30 days';

NOTIFY pgrst, 'reload schema';
