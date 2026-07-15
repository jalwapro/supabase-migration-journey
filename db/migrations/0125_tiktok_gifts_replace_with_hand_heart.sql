-- 0125: Remove previously added TikTok-style gifts (from 0123/0124) and add Hand Heart
BEGIN;

-- Delete the 6 TikTok-style gifts added in 0123
DELETE FROM public.gifts
WHERE name IN (
  'Rose Storm',
  'Lion Roar',
  'Galaxy Portal',
  'Dragon Flame',
  'Crown King',
  'Heart Fireworks'
);

-- Insert new Hand Heart gift (MP4 on pure-black background, screen-blend in player)
INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation,
   sort_order, is_active, active, clip_path, clip_type, image_url, sound_url)
VALUES
  ('Hand Heart', '🤝', '🤝', 39, 39, 20, 'romantic', 'burst',
   9100, true, true,
   '/__l5e/assets-v1/34f69210-8451-475c-b1c5-cc0348c43ec8/tiktok-hand-heart.mp4',
   'mp4', NULL, NULL)
ON CONFLICT DO NOTHING;

COMMIT;
