-- Admin-controlled chromakey / blend mode per gift.
-- Values: 'auto' (default), 'none', 'screen', 'luma'
--  auto   → runtime uses name-based heuristic (existing behaviour)
--  none   → render as-is, no key
--  screen → mix-blend-mode: screen (knock out pure-black bg)
--  luma   → SVG luma-key filter (aggressive black removal, VIP tier)

ALTER TABLE public.gifts
  ADD COLUMN IF NOT EXISTS chromakey text NOT NULL DEFAULT 'auto';

ALTER TABLE public.gifts
  DROP CONSTRAINT IF EXISTS gifts_chromakey_check;
ALTER TABLE public.gifts
  ADD CONSTRAINT gifts_chromakey_check
  CHECK (chromakey IN ('auto','none','screen','luma'));

-- Denormalize onto gift_sends so viewers get the setting with zero extra queries.
ALTER TABLE public.gift_sends
  ADD COLUMN IF NOT EXISTS gift_chromakey text;

UPDATE public.gift_sends gs
   SET gift_chromakey = g.chromakey
  FROM public.gifts g
 WHERE gs.gift_id = g.id
   AND gs.gift_chromakey IS NULL;

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
    SELECT name, emoji, icon, animation, clip_path, clip_type, image_url, sound_url, chromakey
      INTO NEW.gift_name, NEW.gift_emoji, NEW.gift_icon, NEW.gift_animation,
           NEW.gift_clip_path, NEW.gift_clip_type, NEW.gift_image_url,
           NEW.gift_sound_url, NEW.gift_chromakey
      FROM public.gifts WHERE id = NEW.gift_id;
  ELSIF NEW.gift_chromakey IS NULL AND NEW.gift_id IS NOT NULL THEN
    SELECT chromakey INTO NEW.gift_chromakey
      FROM public.gifts WHERE id = NEW.gift_id;
  END IF;
  RETURN NEW;
END $$;

NOTIFY pgrst, 'reload schema';
