-- Cleanup: drop legacy 1-arg overloads. The 2-arg versions are strict supersets
-- (second arg defaults), so all existing callers continue to work.
DROP FUNCTION IF EXISTS public.approve_recharge(uuid);
DROP FUNCTION IF EXISTS public.purchase_shop_item(uuid);
NOTIFY pgrst, 'reload schema';
