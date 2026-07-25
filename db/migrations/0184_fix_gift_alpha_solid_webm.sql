BEGIN;

-- Replace soft-alpha WebM gift clips with corrected VP9-alpha clips where the
-- foreground is fully opaque and only the real background is transparent.
-- This prevents the room/video behind the gift from bleeding through the gift body.
UPDATE public.gifts
SET clip_path = '/__l5e/assets-v1/31a599c0-8fac-4615-b0f1-76ac1ae30a65/money-gun-jalwa-solid.webm',
    clip_type = 'webm'
WHERE lower(name) = 'money gun jalwa';

UPDATE public.gifts
SET clip_path = '/__l5e/assets-v1/3839344b-7d2f-4ae3-be15-b3e29fe95e3c/hand-heart-solid.webm',
    clip_type = 'webm'
WHERE lower(name) = 'hand heart';

UPDATE public.gifts
SET clip_path = '/__l5e/assets-v1/9509c9bc-997e-4173-86fb-5b9019434457/flower-jalwa-solid.webm',
    clip_type = 'webm'
WHERE lower(name) = 'flower jalwa';

UPDATE public.gifts
SET clip_path = '/__l5e/assets-v1/e49e6985-fb7a-48be-9e6e-17bfdc796a2a/heart-jalwa-solid.webm',
    clip_type = 'webm'
WHERE lower(name) = 'heart jalwa';

COMMIT;