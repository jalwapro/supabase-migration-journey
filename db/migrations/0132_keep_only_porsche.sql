-- 0132: Delete every gift except Porsche
BEGIN;
DELETE FROM public.gift_sends WHERE gift_id IN (SELECT id FROM public.gifts WHERE lower(name) <> 'porsche');
DELETE FROM public.gifts WHERE lower(name) <> 'porsche';
COMMIT;
