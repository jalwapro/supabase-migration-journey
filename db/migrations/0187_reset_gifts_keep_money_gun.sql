-- Delete all gifts except Money Gun Jalwa
DELETE FROM public.gift_sends WHERE gift_id IN (
  SELECT id FROM public.gifts WHERE name <> 'Money Gun Jalwa'
);
DELETE FROM public.gift_events WHERE gift_id IN (
  SELECT id FROM public.gifts WHERE name <> 'Money Gun Jalwa'
);
DELETE FROM public.gifts WHERE name <> 'Money Gun Jalwa';
