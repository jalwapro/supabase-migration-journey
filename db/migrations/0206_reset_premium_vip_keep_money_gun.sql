-- Remove all Premium/VIP/Legendary gifts except Jalwa Money Gun.
-- User will add new premium/vip gifts one by one manually.
DELETE FROM public.gift_sends
WHERE gift_id IN (
  SELECT id FROM public.gifts
  WHERE category IN ('premium','vip','luxury','legendary')
    AND name <> 'Jalwa Money Gun'
);

DELETE FROM public.gift_events
WHERE gift_id IN (
  SELECT id FROM public.gifts
  WHERE category IN ('premium','vip','luxury','legendary')
    AND name <> 'Jalwa Money Gun'
);

DELETE FROM public.gifts
WHERE category IN ('premium','vip','luxury','legendary')
  AND name <> 'Jalwa Money Gun';
