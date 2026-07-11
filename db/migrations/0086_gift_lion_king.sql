-- 0086 Lion King premium MP4 gift
BEGIN;
INSERT INTO public.gifts (name, emoji, icon, price, price_coins, diamonds_value, category, animation, sort_order, clip_path, clip_type, is_active, active)
VALUES (
  'Jalwa Lion King', '🦁', '🦁',
  50000, 50000, 25000,
  'luxury', 'burst', 1,
  '/__l5e/assets-v1/7cee6362-c5c9-4f98-8b0c-6f90a867ca40/jalwa-lion-king.mp4',
  'mp4', true, true
)
ON CONFLICT DO NOTHING;

UPDATE public.gifts
SET clip_path='/__l5e/assets-v1/7cee6362-c5c9-4f98-8b0c-6f90a867ca40/jalwa-lion-king.mp4',
    clip_type='mp4', is_active=true, active=true
WHERE name='Jalwa Lion King';
COMMIT;
SELECT id, name, price_coins, clip_type FROM public.gifts WHERE name='Jalwa Lion King';
