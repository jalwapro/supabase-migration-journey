-- P0: Drop the legacy 2-arg send_gift overload.
-- It bypasses coin/diamond updates under the profiles guard trigger
-- (never sets app.trusted_definer) yet still writes ledger + broadcasts,
-- letting any client call the 2-arg RPC to fake a "gift sent" event
-- with no coin charge. All app callers use the 5-arg shape.
DROP FUNCTION IF EXISTS public.send_gift(uuid, uuid);

-- P2: gift_events has a SELECT-only RLS policy but 'authenticated' has
-- direct INSERT/UPDATE/DELETE table grants. Currently blocked by RLS,
-- but a future permissive policy would silently expose the ledger.
-- Mirror the hardening already applied to public.gifts.
REVOKE INSERT, UPDATE, DELETE ON public.gift_events FROM authenticated;
