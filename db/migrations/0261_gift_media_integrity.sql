-- 0261: Gift media integrity
-- 1) Gifts flagged as video but with no clip -> clear clip_type (icon animation instead of stale video)
-- 2) Force green chroma key on every video gift (all clips are green-screen sourced)
-- 3) Deactivate duplicate gifts whose name does not match the shared clip they point at
--    (fixes "sent Money Gun but a car played" style mismatches)

UPDATE public.gifts
SET clip_type = NULL
WHERE (clip_path IS NULL OR btrim(clip_path) = '')
  AND clip_type IS NOT NULL;

UPDATE public.gifts
SET chromakey = 'green'
WHERE clip_path IS NOT NULL
  AND btrim(clip_path) <> ''
  AND lower(clip_path) ~ '\.(mp4|webm)(\?.*)?$'
  AND coalesce(chromakey, 'auto') <> 'none';

UPDATE public.gifts
SET is_active = false
WHERE name IN (
  'Jalwa Bugatti Chiron','Jalwa Speed Racer','Jalwa Lamborghini Storm',
  'Jalwa Ruby Heart','Jalwa Diamond Butterflies',
  'Jalwa Golden Peacock','Jalwa Silver Unicorn',
  'Jalwa Private Island','Jalwa Royal Elephant',
  'Romantic Couple',
  'Jalwa Phoenix Rebirth',
  'Jalwa Enchanted Garden',
  'Pegasus of Love',
  'Jalwa Moonlight Swan',
  'Jalwa Crystal Piano',
  'Jalwa Ice Dragon',
  'Jalwa Cosmic Wedding',
  'Jalwa Crystal Chandelier',
  'Jalwa Celestial Palace',
  'Jalwa Royal Tiger',
  'Jalwa Diamond Waterfall'
);
