-- Cannot hard-delete gifts (gift_sends history references them via FK).
-- Deactivate all existing gifts EXCEPT Royal Red Rose so they disappear from
-- the UI while preserving past send/transaction history.
UPDATE public.gifts
   SET active = false, is_active = false
 WHERE name <> 'Royal Red Rose';
