-- Add Jalwa Hand Heart gift (VIP), styled like Jalwa Money Gun.
DELETE FROM public.gift_sends WHERE gift_id IN (SELECT id FROM public.gifts WHERE lower(name) = 'jalwa hand heart');
DELETE FROM public.gifts WHERE lower(name) = 'jalwa hand heart';

INSERT INTO public.gifts
  (name, category, price, price_coins, diamonds_value, icon, image_url, icon_path, clip_path, clip_type, animation, is_active, active)
VALUES (
  'Jalwa Hand Heart',
  'vip',
  500,
  500,
  500,
  '/__l5e/assets-v1/b15758c0-c112-42c8-8084-4c914868d670/hand-heart.png',
  '/__l5e/assets-v1/b15758c0-c112-42c8-8084-4c914868d670/hand-heart.png',
  '/__l5e/assets-v1/b15758c0-c112-42c8-8084-4c914868d670/hand-heart.png',
  '/__l5e/assets-v1/9995b8ab-305f-4883-ac34-06b64e96ff17/hand-heart.webm',
  'webm',
  'fullscreen',
  true,
  true
);
