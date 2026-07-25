-- Replace old Money Gun Jalwa with new Jalwa-branded version
DELETE FROM public.gift_sends WHERE gift_id IN (SELECT id FROM public.gifts WHERE name IN ('Money Gun Jalwa','Jalwa Money Gun'));
DELETE FROM public.gifts WHERE name IN ('Money Gun Jalwa','Jalwa Money Gun');

INSERT INTO public.gifts (name, category, price_coins, icon, image_url, clip_path, clip_type, animation, is_active)
VALUES (
  'Jalwa Money Gun',
  'luxury',
  299,
  '💸',
  '/__l5e/assets-v1/333d79e3-31a7-4085-b085-45b9d7950e02/jalwa-money-gun.png',
  '/__l5e/assets-v1/ac06e0c6-6dc2-491a-bc0d-7a341e72fc9b/jalwa-money-gun.webm',
  'webm',
  'fullscreen',
  true
);
