-- 0093 Insert/Update Jalwa Lion King with new realistic 10s TikTok-style clip
BEGIN;

INSERT INTO public.gifts (name, emoji, icon, price, price_coins, diamonds_value, category, animation, sort_order, clip_path, clip_type, is_active, active)
VALUES (
  'Jalwa Lion King', '🦁', '🦁',
  50000, 50000, 25000,
  'luxury', 'burst', 1,
  '/__l5e/assets-v1/7480c1e4-81a8-4706-bfa7-a0071ff005bd/lion-king-tiktok.mp4',
  'mp4', true, true
)
ON CONFLICT DO NOTHING;

UPDATE public.gifts
SET clip_path='/__l5e/assets-v1/7480c1e4-81a8-4706-bfa7-a0071ff005bd/lion-king-tiktok.mp4',
    clip_type='mp4', is_active=true, active=true
WHERE name='Jalwa Lion King';

COMMIT;
SELECT id, name, price_coins, clip_path FROM public.gifts WHERE name='Jalwa Lion King';
