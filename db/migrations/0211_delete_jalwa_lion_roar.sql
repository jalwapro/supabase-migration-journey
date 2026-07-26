-- Remove Jalwa Lion Roar gift entirely.
DELETE FROM public.gift_sends WHERE gift_id IN (SELECT id FROM public.gifts WHERE name='Jalwa Lion Roar');
DELETE FROM public.gift_events WHERE gift_id IN (SELECT id FROM public.gifts WHERE name='Jalwa Lion Roar');
DELETE FROM public.gifts WHERE name='Jalwa Lion Roar';
