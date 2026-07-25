BEGIN;
UPDATE public.gifts
SET clip_path = '/__l5e/assets-v1/9995b8ab-305f-4883-ac34-06b64e96ff17/hand-heart.webm',
    clip_type = 'webm',
    image_url = '/__l5e/assets-v1/b15758c0-c112-42c8-8084-4c914868d670/hand-heart.png',
    icon      = '/__l5e/assets-v1/b15758c0-c112-42c8-8084-4c914868d670/hand-heart.png'
WHERE name = 'Hand Heart';
COMMIT;
