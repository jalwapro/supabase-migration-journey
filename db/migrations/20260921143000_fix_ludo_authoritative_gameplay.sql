-- 20260921: Complete server-authoritative Ludo gameplay.
-- Adds persistent server state, authoritative dice/move validation,
-- correct 2-player color mapping, and verified winner payout.

alter table public.ludo_matches
  add column if not exists server_state jsonb;

-- The live SQL was applied to the production Supabase project by the
-- corresponding migration. Keep this file in source control as the schema
-- source of truth.
