-- The 3 non-alpha WebM frames (yuv420p on dark bg) render as a dark
-- rectangle covering the avatar. Disable them until proper transparent
-- versions are re-generated.
UPDATE public.themes
   SET is_active = false
 WHERE name IN ('Boss Emerald Live', 'Lion Ruby Live', 'Sapphire Crown Live');
