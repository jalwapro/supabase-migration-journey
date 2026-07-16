-- =============================================================
-- PK Match: add optional stake (coins entry) column
-- Used by the dedicated PK setup screen to record how many
-- coins each side agreed to stake. Winner takes the pot.
-- Non-breaking: nullable, defaults to 0.
-- =============================================================

alter table public.pk_invites
  add column if not exists stake_coins int not null default 0
    check (stake_coins >= 0);

alter table public.pk_matches
  add column if not exists stake_coins int not null default 0
    check (stake_coins >= 0);

create index if not exists idx_pk_matches_stake on public.pk_matches(stake_coins);
