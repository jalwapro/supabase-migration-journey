-- Add Jalwa Dancing Horse VIP gift (5000 coins).
DELETE FROM public.gift_sends WHERE gift_id IN (SELECT id FROM public.gifts WHERE lower(name) = 'jalwa dancing horse');
DELETE FROM public.gifts WHERE lower(name) = 'jalwa dancing horse';

INSERT INTO public.gifts
  (name, category, price, price_coins, diamonds_value, icon, image_url, icon_path, clip_path, clip_type, animation, is_active, active)
VALUES (
  'Jalwa Dancing Horse',
  'vip',
  5000,
  5000,
  5000,
  '/__l5e/assets-v1/a877b1fa-1ebd-45b8-ac25-5a30164ce653/jalwa-dancing-horse-thumb.png',
  '/__l5e/assets-v1/a877b1fa-1ebd-45b8-ac25-5a30164ce653/jalwa-dancing-horse-thumb.png',
  '/__l5e/assets-v1/a877b1fa-1ebd-45b8-ac25-5a30164ce653/jalwa-dancing-horse-thumb.png',
  '/__l5e/assets-v1/e03f9bb8-8d26-44a8-98e4-e4db87fab54d/jalwa-dancing-horse.mp4',
  'mp4',
  'fullscreen',
  true,
  true
);
