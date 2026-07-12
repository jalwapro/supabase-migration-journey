-- 0093 Update Jalwa Lion King to new realistic 10s TikTok-style clip
BEGIN;
UPDATE public.gifts
SET clip_path='/__l5e/assets-v1/7480c1e4-81a8-4706-bfa7-a0071ff005bd/lion-king-tiktok.mp4',
    clip_type='mp4',
    is_active=true,
    active=true
WHERE name='Jalwa Lion King';
COMMIT;
SELECT id, name, clip_path FROM public.gifts WHERE name='Jalwa Lion King';
