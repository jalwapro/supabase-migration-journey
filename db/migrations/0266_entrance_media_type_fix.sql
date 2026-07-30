-- Allow plain images as an entrance media type, then retag rows whose media_url
-- is a real image/video file but was still stored as 'svg'.
ALTER TABLE entrance_effects DROP CONSTRAINT IF EXISTS entrance_effects_media_type_check;
ALTER TABLE entrance_effects ADD CONSTRAINT entrance_effects_media_type_check
  CHECK (media_type = ANY (ARRAY['mp4','webm','lottie','svga','svg','image']));

UPDATE entrance_effects SET media_type='image' WHERE media_url ~* '\.(jpg|jpeg|png|webp|gif)$' AND media_type <> 'image';
UPDATE entrance_effects SET media_type='mp4'   WHERE media_url ~* '\.mp4$'  AND media_type <> 'mp4';
UPDATE entrance_effects SET media_type='webm'  WHERE media_url ~* '\.webm$' AND media_type <> 'webm';
