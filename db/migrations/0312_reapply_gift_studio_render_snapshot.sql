-- Ensure every new gift send carries the exact Gift Studio render configuration
-- into the realtime payload consumed by Voice Room GiftAnimationPlayer.
-- This intentionally reuses the existing denormalized trigger function.

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
           audio_volume, render_config
      INTO NEW.gift_name, NEW.gift_emoji, NEW.gift_icon, NEW.gift_animation,
           NEW.gift_clip_path, NEW.gift_clip_type, NEW.gift_image_url,
           NEW.gift_sound_url, NEW.gift_audio_url, NEW.gift_priority,
           NEW.gift_duration_ms, NEW.gift_loop, NEW.gift_audio_volume,
           NEW.gift_render_config
      FROM public.gifts
     WHERE id = NEW.gift_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gift_sends_fill_denorm ON public.gift_sends;
CREATE TRIGGER trg_gift_sends_fill_denorm
  BEFORE INSERT ON public.gift_sends
  FOR EACH ROW EXECUTE FUNCTION public.gift_sends_fill_denorm();

-- Keep recent/replayed gifts aligned with the Gift Studio configuration.
UPDATE public.gift_sends s
   SET gift_render_config = g.render_config
  FROM public.gifts g
 WHERE g.id = s.gift_id
   AND s.created_at > now() - interval '30 days';

NOTIFY pgrst, 'reload schema';
