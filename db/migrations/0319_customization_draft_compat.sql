-- Compatibility for the existing Admin Customization Studio.
-- Older Studio builds query is_active; keep that API-compatible without changing the
-- canonical draft status model.
ALTER TABLE public.app_customization_drafts
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_app_customization_drafts_active
  ON public.app_customization_drafts(page_id, is_active, updated_at DESC);

UPDATE public.app_customization_drafts
SET is_active = (status <> 'archived');
