-- Keep the active-draft flag used by the Admin Customization Studio in the canonical schema.
-- Safe for databases where the column already exists.

ALTER TABLE public.app_customization_drafts
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_app_customization_drafts_active
  ON public.app_customization_drafts(page_id, is_active, updated_at DESC);

-- At most one active draft per page.
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_customization_drafts_active
  ON public.app_customization_drafts(page_id)
  WHERE is_active = true;

NOTIFY pgrst, 'reload schema';
