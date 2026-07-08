-- 0023_dedupe_theme_categories.sql
-- Remove duplicate rows in theme_categories (same slug) and prevent future dupes.
-- For each slug, the earliest (sort_order, id) row is kept as canonical; themes
-- pointing at duplicate categories are remapped to the canonical id.

BEGIN;

WITH ranked AS (
  SELECT id, slug, row_number() OVER (PARTITION BY slug ORDER BY sort_order, id) AS rn
  FROM public.theme_categories
  WHERE slug IS NOT NULL
),
keep AS (SELECT slug, id AS keep_id FROM ranked WHERE rn = 1),
dupes AS (
  SELECT r.id AS dup_id, k.keep_id
  FROM ranked r JOIN keep k USING(slug)
  WHERE r.rn > 1
)
UPDATE public.themes t
   SET category_id = d.keep_id
  FROM dupes d
 WHERE t.category_id = d.dup_id;

DELETE FROM public.theme_categories tc
USING (
  SELECT id FROM (
    SELECT id, slug,
           row_number() OVER (PARTITION BY slug ORDER BY sort_order, id) AS rn
      FROM public.theme_categories
     WHERE slug IS NOT NULL
  ) x
  WHERE rn > 1
) d
WHERE tc.id = d.id;

CREATE UNIQUE INDEX IF NOT EXISTS theme_categories_slug_unique
  ON public.theme_categories(slug)
  WHERE slug IS NOT NULL;

COMMIT;
