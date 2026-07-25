-- Money Gun: swap MP4 for chromakey-processed transparent WebM
UPDATE public.gifts
SET clip_path = '/__l5e/assets-v1/e8d67ae5-0bf3-4cef-bad3-50865fee88e9/money-gun-transparent.webm',
    clip_type = 'webm',
    image_url = '/__l5e/assets-v1/39ec4634-88f4-41cd-a2d9-b6a9c4f94025/money-gun-thumb.png',
    icon = '/__l5e/assets-v1/39ec4634-88f4-41cd-a2d9-b6a9c4f94025/money-gun-thumb.png',
    updated_at = now()
WHERE lower(name) LIKE '%money gun%';
