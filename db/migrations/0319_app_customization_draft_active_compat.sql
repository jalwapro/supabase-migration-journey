-- Compatibility fix for the live customization studio.
-- Keeps existing draft rows intact and adds the active-draft state used by the admin editor.
ALTER TABLE public.app_customization_drafts
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_app_customization_drafts_active
  ON public.app_customization_drafts(page_id, is_active, updated_at DESC);

-- Keep at most one active draft per page. Existing duplicate rows are retained but
-- only the newest row remains active.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY page_id ORDER BY updated_at DESC, created_at DESC, id DESC) AS rn
  FROM public.app_customization_drafts
  WHERE is_active = true
)
UPDATE public.app_customization_drafts d
SET is_active = false
FROM ranked r
WHERE d.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_customization_drafts_active
  ON public.app_customization_drafts(page_id)
  WHERE is_active = true;

NOTIFY pgrst, 'reload schema';
