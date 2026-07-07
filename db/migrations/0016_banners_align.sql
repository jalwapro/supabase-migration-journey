-- Align banners schema with app code (image_url/link_url/active)
ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS link_url TEXT,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

UPDATE public.banners
   SET image_url = COALESCE(image_url, image),
       link_url  = COALESCE(link_url, link),
       active    = COALESCE(active, is_active);
