-- Batch 2: 10 premium/luxury/VIP gifts (6k - 100k coins) with cinematic MP4 animations.
DO $$
DECLARE
  gift_names text[] := ARRAY[
    'Jalwa Sapphire Fountain',
    'Jalwa Silver Unicorn',
    'Jalwa Royal Tiger',
    'Jalwa Enchanted Garden',
    'Jalwa Ice Dragon',
    'Jalwa Crystal Piano',
    'Jalwa Lamborghini Storm',
    'Jalwa Superyacht',
    'Jalwa Emerald Necklace',
    'Jalwa Celestial Palace'
  ];
  n text;
BEGIN
  FOREACH n IN ARRAY gift_names LOOP
    DELETE FROM public.gift_sends WHERE gift_id IN (SELECT id FROM public.gifts WHERE lower(name) = lower(n));
    DELETE FROM public.gifts WHERE lower(name) = lower(n);
  END LOOP;
END $$;

INSERT INTO public.gifts
  (name, category, price, price_coins, diamonds_value, icon, image_url, icon_path, clip_path, clip_type, animation, is_active, active)
VALUES
  ('Jalwa Sapphire Fountain', 'vip', 6000, 6000, 6000,
    '/__l5e/assets-v1/0bee01cd-5703-46a5-b4e2-2b47c86f629f/thumb_sapphire_fountain.png',
    '/__l5e/assets-v1/0bee01cd-5703-46a5-b4e2-2b47c86f629f/thumb_sapphire_fountain.png',
    '/__l5e/assets-v1/0bee01cd-5703-46a5-b4e2-2b47c86f629f/thumb_sapphire_fountain.png',
    '/__l5e/assets-v1/d5f2c71e-bab7-45a3-bf6e-85335fc07ae2/gift_sapphire_fountain.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Silver Unicorn', 'vip', 9000, 9000, 9000,
    '/__l5e/assets-v1/0dce3a65-4dd2-4f9e-9068-c75e5117af29/thumb_silver_unicorn.png',
    '/__l5e/assets-v1/0dce3a65-4dd2-4f9e-9068-c75e5117af29/thumb_silver_unicorn.png',
    '/__l5e/assets-v1/0dce3a65-4dd2-4f9e-9068-c75e5117af29/thumb_silver_unicorn.png',
    '/__l5e/assets-v1/fdb20413-5f64-41e0-a386-a1588f1b2702/gift_silver_unicorn.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Royal Tiger', 'vip', 14000, 14000, 14000,
    '/__l5e/assets-v1/a69d1d42-be4f-46cc-a46c-edb500b54974/thumb_royal_tiger.png',
    '/__l5e/assets-v1/a69d1d42-be4f-46cc-a46c-edb500b54974/thumb_royal_tiger.png',
    '/__l5e/assets-v1/a69d1d42-be4f-46cc-a46c-edb500b54974/thumb_royal_tiger.png',
    '/__l5e/assets-v1/20b5e3a5-7280-42f0-be2b-7e59a3ae73f4/gift_royal_tiger.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Enchanted Garden', 'vip', 18000, 18000, 18000,
    '/__l5e/assets-v1/e594f4fc-0b30-4530-98c7-2dfd49418562/thumb_enchanted_garden.png',
    '/__l5e/assets-v1/e594f4fc-0b30-4530-98c7-2dfd49418562/thumb_enchanted_garden.png',
    '/__l5e/assets-v1/e594f4fc-0b30-4530-98c7-2dfd49418562/thumb_enchanted_garden.png',
    '/__l5e/assets-v1/d3d66a07-07c0-4e8f-80ae-90f7d9d1c55e/gift_enchanted_garden.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Ice Dragon', 'vip', 28000, 28000, 28000,
    '/__l5e/assets-v1/5134c927-9bfa-4755-bb48-2baa5e34a6b0/thumb_ice_dragon.png',
    '/__l5e/assets-v1/5134c927-9bfa-4755-bb48-2baa5e34a6b0/thumb_ice_dragon.png',
    '/__l5e/assets-v1/5134c927-9bfa-4755-bb48-2baa5e34a6b0/thumb_ice_dragon.png',
    '/__l5e/assets-v1/5209a703-4922-4e71-946a-50714f6fb7cf/gift_ice_dragon.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Crystal Piano', 'vip', 38000, 38000, 38000,
    '/__l5e/assets-v1/73226db9-289e-44bb-b89b-543fe34396cc/thumb_crystal_piano.png',
    '/__l5e/assets-v1/73226db9-289e-44bb-b89b-543fe34396cc/thumb_crystal_piano.png',
    '/__l5e/assets-v1/73226db9-289e-44bb-b89b-543fe34396cc/thumb_crystal_piano.png',
    '/__l5e/assets-v1/c2171181-4f69-4bf3-918d-b6282093c343/gift_crystal_piano.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Lamborghini Storm', 'vip', 48000, 48000, 48000,
    '/__l5e/assets-v1/286cb957-6152-4436-a3e3-12a845cb754a/thumb_lamborghini.png',
    '/__l5e/assets-v1/286cb957-6152-4436-a3e3-12a845cb754a/thumb_lamborghini.png',
    '/__l5e/assets-v1/286cb957-6152-4436-a3e3-12a845cb754a/thumb_lamborghini.png',
    '/__l5e/assets-v1/7443ada1-fcaf-482f-986f-db9826833fd9/gift_lamborghini.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Superyacht', 'vip', 65000, 65000, 65000,
    '/__l5e/assets-v1/86cc3bbc-6bd9-4bb7-83d9-8efcd94916fc/thumb_superyacht.png',
    '/__l5e/assets-v1/86cc3bbc-6bd9-4bb7-83d9-8efcd94916fc/thumb_superyacht.png',
    '/__l5e/assets-v1/86cc3bbc-6bd9-4bb7-83d9-8efcd94916fc/thumb_superyacht.png',
    '/__l5e/assets-v1/e2921934-d8ab-4f54-b067-5078b0ea1984/gift_superyacht.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Emerald Necklace', 'vip', 85000, 85000, 85000,
    '/__l5e/assets-v1/60f1a9ba-611e-418e-829b-ca711b1b9b4d/thumb_emerald_necklace.png',
    '/__l5e/assets-v1/60f1a9ba-611e-418e-829b-ca711b1b9b4d/thumb_emerald_necklace.png',
    '/__l5e/assets-v1/60f1a9ba-611e-418e-829b-ca711b1b9b4d/thumb_emerald_necklace.png',
    '/__l5e/assets-v1/29e5f990-6f90-4d0e-ada0-c916eb47fe61/gift_emerald_necklace.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Celestial Palace', 'vip', 100000, 100000, 100000,
    '/__l5e/assets-v1/3353790c-6126-4c63-84ac-17ac3c073e14/thumb_celestial_palace.png',
    '/__l5e/assets-v1/3353790c-6126-4c63-84ac-17ac3c073e14/thumb_celestial_palace.png',
    '/__l5e/assets-v1/3353790c-6126-4c63-84ac-17ac3c073e14/thumb_celestial_palace.png',
    '/__l5e/assets-v1/f75ac106-a684-4d49-ad14-802a839d57e2/gift_celestial_palace.mp4',
    'mp4', 'fullscreen', true, true);
