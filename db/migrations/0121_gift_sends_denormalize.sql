-- Scale fix: denormalize sender + receiver + gift onto gift_sends so
-- realtime viewers can render the full-screen animation with ZERO extra
-- queries. Before: every gift → each of N viewers ran 3 lookups (sender,
-- receiver, gift). A 5k-viewer room = 15,000 queries per gift.

ALTER TABLE public.gift_sends
  ADD COLUMN IF NOT EXISTS sender_username   text,
  ADD COLUMN IF NOT EXISTS sender_avatar     text,
  ADD COLUMN IF NOT EXISTS receiver_username text,
  ADD COLUMN IF NOT EXISTS receiver_avatar   text,
  ADD COLUMN IF NOT EXISTS gift_name         text,
  ADD COLUMN IF NOT EXISTS gift_emoji        text,
  ADD COLUMN IF NOT EXISTS gift_icon         text,
  ADD COLUMN IF NOT EXISTS gift_animation    text,
  ADD COLUMN IF NOT EXISTS gift_clip_path    text,
  ADD COLUMN IF NOT EXISTS gift_clip_type    text,
  ADD COLUMN IF NOT EXISTS gift_image_url    text,
  ADD COLUMN IF NOT EXISTS gift_sound_url    text;

-- Backfill existing rows (idempotent — only fills nulls).
UPDATE public.gift_sends gs
   SET sender_username   = ps.username,
       sender_avatar     = ps.avatar
  FROM public.profiles ps
 WHERE gs.sender_id = ps.id
   AND gs.sender_username IS NULL;

UPDATE public.gift_sends gs
   SET receiver_username = pr.username,
       receiver_avatar   = pr.avatar
  FROM public.profiles pr
 WHERE gs.receiver_id = pr.id
   AND gs.receiver_username IS NULL;

UPDATE public.gift_sends gs
   SET gift_name      = g.name,
       gift_emoji     = g.emoji,
       gift_icon      = g.icon,
       gift_animation = g.animation,
       gift_clip_path = g.clip_path,
       gift_clip_type = g.clip_type,
       gift_image_url = g.image_url,
       gift_sound_url = g.sound_url
  FROM public.gifts g
 WHERE gs.gift_id = g.id
   AND gs.gift_name IS NULL;

-- Auto-fill on insert.
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
  IF NEW.gift_name IS NULL AND NEW.gift_id IS NOT NULL THEN
    SELECT name, emoji, icon, animation, clip_path, clip_type, image_url, sound_url
      INTO NEW.gift_name, NEW.gift_emoji, NEW.gift_icon, NEW.gift_animation,
           NEW.gift_clip_path, NEW.gift_clip_type, NEW.gift_image_url, NEW.gift_sound_url
      FROM public.gifts WHERE id = NEW.gift_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gift_sends_fill_denorm ON public.gift_sends;
CREATE TRIGGER trg_gift_sends_fill_denorm
  BEFORE INSERT ON public.gift_sends
  FOR EACH ROW EXECUTE FUNCTION public.gift_sends_fill_denorm();

NOTIFY pgrst, 'reload schema';
