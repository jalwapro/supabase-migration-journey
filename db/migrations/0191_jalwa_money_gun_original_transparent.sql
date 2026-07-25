-- Replace Jalwa Money Gun clip with original video (black background chroma-keyed to transparent).
UPDATE public.gifts
SET clip_path = '/__l5e/assets-v1/fdf6684f-8b39-4a8b-bece-ea89dc1a99b1/money-gun-orig-transparent.webm',
    clip_type = 'webm',
    image_url = '/__l5e/assets-v1/04aeaa67-85d9-403e-a3b7-627dbd0b0c5c/money-gun-orig-thumb.png',
    icon_path = '/__l5e/assets-v1/04aeaa67-85d9-403e-a3b7-627dbd0b0c5c/money-gun-orig-thumb.png',
    icon = '/__l5e/assets-v1/04aeaa67-85d9-403e-a3b7-627dbd0b0c5c/money-gun-orig-thumb.png',
    animation = 'fullscreen',
    is_active = true,
    active = true
WHERE lower(name) LIKE '%money gun%';
