-- Room top-rank frame library: admin-managed decorative frames overlaid on
-- the top-1 and top-2 gifting room cards on the Home page.
-- Supports PNG (transparent), SVGA, MP4/WebM (chromakey green/black/none).

CREATE TABLE IF NOT EXISTS public.room_top_frames (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  media_url    text NOT NULL,
  media_type   text NOT NULL CHECK (media_type IN ('png','svga','mp4','webm','gif')),
  chromakey    text NOT NULL DEFAULT 'none' CHECK (chromakey IN ('none','green','black','luma')),
  slot         int  NOT NULL DEFAULT 0 CHECK (slot IN (0,1,2)),   -- 1=1st place, 2=2nd place, 0=library
  is_active    boolean NOT NULL DEFAULT true,
  sort_order   int NOT NULL DEFAULT 99,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS room_top_frames_slot_idx
  ON public.room_top_frames (slot) WHERE slot > 0;

-- Only one active frame may occupy slot 1 or slot 2 at a time.
CREATE UNIQUE INDEX IF NOT EXISTS room_top_frames_slot_unique
  ON public.room_top_frames (slot)
  WHERE slot > 0 AND is_active = true;

GRANT SELECT ON public.room_top_frames TO anon, authenticated;
GRANT ALL   ON public.room_top_frames TO service_role;

ALTER TABLE public.room_top_frames ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_top_frames read all"   ON public.room_top_frames;
DROP POLICY IF EXISTS "room_top_frames admin write" ON public.room_top_frames;

CREATE POLICY "room_top_frames read all"
  ON public.room_top_frames FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "room_top_frames admin write"
  ON public.room_top_frames FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed the current two JALWA frames (already live on Home) as slot 1 & 2.
INSERT INTO public.room_top_frames (name, media_url, media_type, chromakey, slot, sort_order)
VALUES
  ('JALWA Gold (1st)',   '/__l5e/assets-v1/f5eb5f8b-0501-4b1b-835e-1d5c8b2111e1/jalwa-frame-gold.png',   'png', 'none', 1, 1),
  ('JALWA Violet (2nd)', '/__l5e/assets-v1/160eab55-765c-4a91-b71b-c8e6ac3d1954/jalwa-frame-violet.png', 'png', 'none', 2, 2)
ON CONFLICT DO NOTHING;
