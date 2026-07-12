-- Now that any viewer can claim an open unlocked seat directly via take_seat RPC,
-- the self-claim guard from 0101 must be removed — take_seat already enforces
-- host-only seat 0, locked-seat host/mod check, and ban rules (via check_room_ban).

drop trigger if exists trg_guard_self_seat_claim_ins on public.room_members;
drop trigger if exists trg_guard_self_seat_claim_upd on public.room_members;
drop function if exists public.trg_guard_self_seat_claim();
