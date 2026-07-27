-- Delete ALL VIP / Premium / Luxury / Legendary gifts (fresh start).
-- User will add new ones one by one with green chromakey backgrounds.
BEGIN;

DELETE FROM public.gift_sends
WHERE gift_id IN (
  SELECT id FROM public.gifts
  WHERE category IN ('premium','vip','luxury','legendary')
);

DELETE FROM public.gift_events
WHERE gift_id IN (
  SELECT id FROM public.gifts
  WHERE category IN ('premium','vip','luxury','legendary')
);

DELETE FROM public.gifts
WHERE category IN ('premium','vip','luxury','legendary');

COMMIT;
