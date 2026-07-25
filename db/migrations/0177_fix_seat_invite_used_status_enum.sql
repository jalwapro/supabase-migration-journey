-- 0177: Fix seat invite accept / seat pick failures caused by enum drift.
--
-- Migrations 0169/0175 correctly consume seat_invites by setting
-- seat_invites.status = 'used', but the original seat_invite_status enum from
-- 0033 did not include 'used'. At runtime Postgres raises:
--   invalid input value for enum seat_invite_status: "used"
-- which makes invite accept / host seat-pick flows fail even though the RPC
-- logic is otherwise correct.

alter type public.seat_invite_status add value if not exists 'used';
