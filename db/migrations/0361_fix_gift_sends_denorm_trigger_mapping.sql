BEGIN;

-- Fix gift_sends denormalization mapping.
-- The previous trigger selected COALESCE(audio_url, sound_url) only once,
-- while assigning to both gift_sound_url and gift_audio_url. That shifted every
-- following column by one position: `loop` (boolean) could land in the integer
-- gift_duration_ms column and produced:
--   invalid input syntax for type integer: "f"
-- during send_gift inserts.
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
      FROM public.profiles
     WHERE id = NEW.sender_id;
  END IF;

  IF NEW.receiver_username IS NULL AND NEW.receiver_id IS NOT NULL THEN
    SELECT username, avatar
      INTO NEW.receiver_username, NEW.receiver_avatar
      FROM public.profiles
     WHERE id = NEW.receiver_id;
  END IF;

  IF NEW.gift_id IS NOT NULL THEN
    SELECT
      name,
      emoji,
      icon,
      animation,
      clip_path,
      clip_type,
      image_url,
      sound_url,
      audio_url,
      priority,
      duration_ms,
      loop,
      audio_volume,
      render_config
      INTO
        NEW.gift_name,
        NEW.gift_emoji,
        NEW.gift_icon,
        NEW.gift_animation,
        NEW.gift_clip_path,
        NEW.gift_clip_type,
        NEW.gift_image_url,
        NEW.gift_sound_url,
        NEW.gift_audio_url,
        NEW.gift_priority,
        NEW.gift_duration_ms,
        NEW.gift_loop,
        NEW.gift_audio_volume,
        NEW.gift_render_config
      FROM public.gifts
     WHERE id = NEW.gift_id;
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
