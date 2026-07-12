-- Golden cinematic lion v12
BEGIN;
UPDATE public.gifts
SET clip_path='/__l5e/assets-v1/834758c9-b501-47cf-b0a1-5adbd0b6b33a/royal-lion-v12-golden.mp4',
    clip_type='mp4',
    sound_url=NULL,
    is_active=true,
    active=true
WHERE name IN ('Royal Lion','Jalwa Lion King');
COMMIT;
