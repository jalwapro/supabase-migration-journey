-- Backfill lock timestamps for existing country records.
UPDATE public.profiles
SET country_locked_at = COALESCE(country_locked_at, created_at, now())
WHERE country_locked_at IS NULL
  AND (
    NULLIF(BTRIM(country), '') IS NOT NULL
    OR NULLIF(BTRIM(country_code), '') IS NOT NULL
  );
