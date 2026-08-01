-- Gift Engine v2 part 2: authoritative asset snapshot on gift_sends +
-- server-side gift goal progression.

ALTER TABLE public.gift_sends
  ADD COLUMN IF NOT EXISTS gift_audio_url text,
  ADD COLUMN IF NOT EXISTS gift_priority integer,
  ADD COLUMN IF NOT EXISTS gift_duration_ms integer,
  ADD COLUMN IF NOT EXISTS gift_loop boolean,
  ADD COLUMN IF NOT EXISTS gift_audio_volume numeric(3,2);

-- Always snapshot the CURRENT gift assets (clients must not be able to send
-- their own URLs, and stale client caches must not resurrect dead CDN links).
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
           COALESCE(audio_url, sound_url), priority, duration_ms, loop, audio_volume
      INTO NEW.gift_name, NEW.gift_emoji, NEW.gift_icon, NEW.gift_animation,
           NEW.gift_clip_path, NEW.gift_clip_type, NEW.gift_image_url,
           NEW.gift_sound_url, NEW.gift_chromakey,
           NEW.gift_audio_url, NEW.gift_priority, NEW.gift_duration_ms,
           NEW.gift_loop, NEW.gift_audio_volume
      FROM public.gifts WHERE id = NEW.gift_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Feed the room gift goal from every gift send, server-side, so all viewers
-- see the identical percentage via the room_gift_goals realtime UPDATE.
CREATE OR REPLACE FUNCTION public.tg_gift_send_bump_goal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.room_id IS NOT NULL AND COALESCE(NEW.coins_spent, 0) > 0 THEN
    PERFORM public.bump_room_gift_goal(NEW.room_id, NEW.coins_spent);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gift_send_bump_goal ON public.gift_sends;
CREATE TRIGGER trg_gift_send_bump_goal
  AFTER INSERT ON public.gift_sends
  FOR EACH ROW EXECUTE FUNCTION public.tg_gift_send_bump_goal();

-- Backfill the new snapshot columns for recent rows so replays look right.
UPDATE public.gift_sends s
   SET gift_audio_url = COALESCE(g.audio_url, g.sound_url),
       gift_priority = g.priority,
       gift_duration_ms = g.duration_ms,
       gift_loop = g.loop,
       gift_audio_volume = g.audio_volume,
       gift_clip_path = g.clip_path,
       gift_image_url = g.image_url,
       gift_icon = g.icon,
       gift_sound_url = COALESCE(g.audio_url, g.sound_url)
  FROM public.gifts g
 WHERE g.id = s.gift_id
   AND s.created_at > now() - interval '30 days';
