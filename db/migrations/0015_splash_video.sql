-- Splash video support + admin control
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS splash_video text,
  ADD COLUMN IF NOT EXISTS splash_video_poster text;

-- Ensure singleton row exists
INSERT INTO public.app_settings (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;

-- Public storage bucket for splash assets (video + poster) if not present
INSERT INTO storage.buckets (id, name, public)
VALUES ('splash', 'splash', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read; only admins can write
DROP POLICY IF EXISTS "Splash public read" ON storage.objects;
CREATE POLICY "Splash public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'splash');

DROP POLICY IF EXISTS "Splash admin write" ON storage.objects;
CREATE POLICY "Splash admin write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'splash' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Splash admin update" ON storage.objects;
CREATE POLICY "Splash admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'splash' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Splash admin delete" ON storage.objects;
CREATE POLICY "Splash admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'splash' AND public.is_admin(auth.uid()));
