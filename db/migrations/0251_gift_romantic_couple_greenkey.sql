-- Fresh romantic couple VIP gift with pure green chromakey background.
BEGIN;

DELETE FROM public.gift_sends WHERE gift_id IN (SELECT id FROM public.gifts WHERE lower(name) = 'romantic couple');
DELETE FROM public.gifts WHERE lower(name) = 'romantic couple';

INSERT INTO public.gifts
  (name, category, price, price_coins, diamonds_value, icon, image_url, icon_path, clip_path, clip_type, animation, chromakey, is_active, active)
VALUES (
  'Romantic Couple',
  'vip',
  15000, 15000, 15000,
  '/__l5e/assets-v1/e1b294f5-8263-4a01-9fd7-a0002a321972/romantic-couple-greenkey.mp4',
  '/__l5e/assets-v1/e1b294f5-8263-4a01-9fd7-a0002a321972/romantic-couple-greenkey.mp4',
  '/__l5e/assets-v1/e1b294f5-8263-4a01-9fd7-a0002a321972/romantic-couple-greenkey.mp4',
  '/__l5e/assets-v1/e1b294f5-8263-4a01-9fd7-a0002a321972/romantic-couple-greenkey.mp4',
  'mp4', 'fullscreen', 'green', true, true
);

NOTIFY pgrst, 'reload schema';
COMMIT;
