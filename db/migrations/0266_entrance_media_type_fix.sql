-- Rows that point at a real image/video file were still tagged media_type='svg'.
-- Tag them by their actual extension so the admin editor and player agree.
UPDATE entrance_effects SET media_type = 'image'
 WHERE media_url ~* '\.(jpg|jpeg|png|webp|gif)$' AND media_type <> 'image';
UPDATE entrance_effects SET media_type = 'mp4'
 WHERE media_url ~* '\.mp4$' AND media_type <> 'mp4';
UPDATE entrance_effects SET media_type = 'webm'
 WHERE media_url ~* '\.webm$' AND media_type <> 'webm';
