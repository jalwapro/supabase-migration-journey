-- 0144: Auto-unlock DP frames by VIP level.
-- Adds min_level column to themes and maps the 10 flagship frames to level bands 1..100.
-- Client-side (src/lib/levelFrames.ts) mirrors this mapping so avatars show
-- the correct frame automatically as users level up.

ALTER TABLE public.themes
  ADD COLUMN IF NOT EXISTS min_level integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_themes_min_level ON public.themes (min_level);

-- Level bands (matches src/lib/levelFrames.ts)
UPDATE public.themes SET min_level = 1   WHERE name = 'Divine Gold Aura';
UPDATE public.themes SET min_level = 11  WHERE name = 'Emerald Dragon Frame';
UPDATE public.themes SET min_level = 21  WHERE name = 'Phoenix Fire Frame';
UPDATE public.themes SET min_level = 31  WHERE name = 'Lion Ruby Live';
UPDATE public.themes SET min_level = 41  WHERE name = 'Sapphire Crown Live';
UPDATE public.themes SET min_level = 51  WHERE name = 'Galaxy Nebula Frame';
UPDATE public.themes SET min_level = 61  WHERE name = 'Diamond Ice Frame';
UPDATE public.themes SET min_level = 71  WHERE name = 'Royal King Frame';
UPDATE public.themes SET min_level = 81  WHERE name = 'Golden Phoenix Live';
UPDATE public.themes SET min_level = 91  WHERE name = 'CEO Jalwa';
