-- VIP/Premium gift playback fix: disable automatic black/luma keying for
-- expensive gifts, and allow admins to opt into a green-screen chromakey mode.

ALTER TABLE public.gifts
  DROP CONSTRAINT IF EXISTS gifts_chromakey_check;

ALTER TABLE public.gifts
  ADD CONSTRAINT gifts_chromakey_check
  CHECK (chromakey IN ('auto','none','screen','luma','green'));

UPDATE public.gifts
   SET chromakey = 'none'
 WHERE coalesce(price_coins, price, 0) > 300
    OR lower(coalesce(category, '')) IN ('premium', 'vip', 'luxury');

NOTIFY pgrst, 'reload schema';