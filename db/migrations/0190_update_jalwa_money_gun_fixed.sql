-- Update Jalwa Money Gun to the corrected clear transparent WebM.
UPDATE public.gifts
SET name = 'Jalwa Money Gun',
    category = 'luxury',
    clip_path = '/__l5e/assets-v1/30d65fd5-a129-4e2f-a985-60b183923ab2/jalwa-money-gun-fixed.webm',
    clip_type = 'webm',
    image_url = '/__l5e/assets-v1/4596d226-d68a-407d-9d8f-e457ddcfe008/jalwa-money-gun-fixed-thumb.png',
    icon_path = '/__l5e/assets-v1/4596d226-d68a-407d-9d8f-e457ddcfe008/jalwa-money-gun-fixed-thumb.png',
    icon = '/__l5e/assets-v1/4596d226-d68a-407d-9d8f-e457ddcfe008/jalwa-money-gun-fixed-thumb.png',
    animation = 'fullscreen',
    is_active = true,
    active = true
WHERE lower(name) LIKE '%money gun%';
