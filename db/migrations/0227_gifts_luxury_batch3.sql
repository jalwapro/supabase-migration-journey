-- Batch 3: 10 premium/luxury/VIP gifts (7k - 100k coins) with cinematic MP4 animations.
DO $$
DECLARE
  gift_names text[] := ARRAY[
    'Jalwa Ruby Heart',
    'Jalwa Pegasus',
    'Jalwa Lion Throne',
    'Jalwa Moonlight Swan',
    'Jalwa Phoenix Rebirth',
    'Jalwa Diamond Butterflies',
    'Jalwa Bugatti Chiron',
    'Jalwa Private Island',
    'Jalwa Crown Jewels',
    'Jalwa Cosmic Wedding'
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
  ('Jalwa Ruby Heart', 'vip', 7000, 7000, 7000,
    '/__l5e/assets-v1/fe250fb4-ebdd-402c-b197-1992ea6154b8/thumb_ruby_heart.png',
    '/__l5e/assets-v1/fe250fb4-ebdd-402c-b197-1992ea6154b8/thumb_ruby_heart.png',
    '/__l5e/assets-v1/fe250fb4-ebdd-402c-b197-1992ea6154b8/thumb_ruby_heart.png',
    '/__l5e/assets-v1/62a3edc0-26b0-4641-8719-e433a9ea68aa/gift_ruby_heart.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Pegasus', 'vip', 11000, 11000, 11000,
    '/__l5e/assets-v1/0a77e5b3-fc5c-4349-a7eb-0b227d6c0348/thumb_pegasus.png',
    '/__l5e/assets-v1/0a77e5b3-fc5c-4349-a7eb-0b227d6c0348/thumb_pegasus.png',
    '/__l5e/assets-v1/0a77e5b3-fc5c-4349-a7eb-0b227d6c0348/thumb_pegasus.png',
    '/__l5e/assets-v1/fcff37a8-3b2c-4b2b-94fc-2b93160234d3/gift_pegasus.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Lion Throne', 'vip', 16000, 16000, 16000,
    '/__l5e/assets-v1/531afb80-42b3-456d-bcf5-0e814f80dff2/thumb_lion_throne.png',
    '/__l5e/assets-v1/531afb80-42b3-456d-bcf5-0e814f80dff2/thumb_lion_throne.png',
    '/__l5e/assets-v1/531afb80-42b3-456d-bcf5-0e814f80dff2/thumb_lion_throne.png',
    '/__l5e/assets-v1/6ae54d72-ab45-4540-8011-3e97a62be7cd/gift_lion_throne.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Moonlight Swan', 'vip', 20000, 20000, 20000,
    '/__l5e/assets-v1/befcb808-e55c-4649-8de5-c24b894160c1/thumb_moonlight_swan.png',
    '/__l5e/assets-v1/befcb808-e55c-4649-8de5-c24b894160c1/thumb_moonlight_swan.png',
    '/__l5e/assets-v1/befcb808-e55c-4649-8de5-c24b894160c1/thumb_moonlight_swan.png',
    '/__l5e/assets-v1/8315544d-f126-41a9-a1bc-6eea5a7e043a/gift_moonlight_swan.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Phoenix Rebirth', 'vip', 30000, 30000, 30000,
    '/__l5e/assets-v1/cca9cfa4-1334-4dcb-9780-02383d3150dd/thumb_phoenix_rebirth.png',
    '/__l5e/assets-v1/cca9cfa4-1334-4dcb-9780-02383d3150dd/thumb_phoenix_rebirth.png',
    '/__l5e/assets-v1/cca9cfa4-1334-4dcb-9780-02383d3150dd/thumb_phoenix_rebirth.png',
    '/__l5e/assets-v1/6e0fc843-3a47-4d52-b9ce-74657ebc73a3/gift_phoenix_rebirth.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Diamond Butterflies', 'vip', 40000, 40000, 40000,
    '/__l5e/assets-v1/f860602f-202e-4fcd-a771-c6dd61297b66/thumb_diamond_butterflies.png',
    '/__l5e/assets-v1/f860602f-202e-4fcd-a771-c6dd61297b66/thumb_diamond_butterflies.png',
    '/__l5e/assets-v1/f860602f-202e-4fcd-a771-c6dd61297b66/thumb_diamond_butterflies.png',
    '/__l5e/assets-v1/64172583-8bd0-4cb2-aece-e21be837d6bc/gift_diamond_butterflies.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Bugatti Chiron', 'vip', 50000, 50000, 50000,
    '/__l5e/assets-v1/20fe0c89-1fe4-4d75-93fd-ae5fd03ee79b/thumb_bugatti.png',
    '/__l5e/assets-v1/20fe0c89-1fe4-4d75-93fd-ae5fd03ee79b/thumb_bugatti.png',
    '/__l5e/assets-v1/20fe0c89-1fe4-4d75-93fd-ae5fd03ee79b/thumb_bugatti.png',
    '/__l5e/assets-v1/6b6bf907-4a68-4cf3-b679-7a3ee63b9103/gift_bugatti.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Private Island', 'vip', 70000, 70000, 70000,
    '/__l5e/assets-v1/ea8898f7-069c-48d2-85a7-48aa525827d3/thumb_private_island.png',
    '/__l5e/assets-v1/ea8898f7-069c-48d2-85a7-48aa525827d3/thumb_private_island.png',
    '/__l5e/assets-v1/ea8898f7-069c-48d2-85a7-48aa525827d3/thumb_private_island.png',
    '/__l5e/assets-v1/bb5a0d45-1122-42c6-9b77-c733cf749e83/gift_private_island.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Crown Jewels', 'vip', 90000, 90000, 90000,
    '/__l5e/assets-v1/2b1408d7-13b2-4151-af55-c8b9793c4901/thumb_crown_jewels.png',
    '/__l5e/assets-v1/2b1408d7-13b2-4151-af55-c8b9793c4901/thumb_crown_jewels.png',
    '/__l5e/assets-v1/2b1408d7-13b2-4151-af55-c8b9793c4901/thumb_crown_jewels.png',
    '/__l5e/assets-v1/c0764e49-76d3-45e1-862d-cdff75835229/gift_crown_jewels.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Cosmic Wedding', 'vip', 100000, 100000, 100000,
    '/__l5e/assets-v1/203fcc20-6152-4793-877d-124216f8fe4d/thumb_cosmic_wedding.png',
    '/__l5e/assets-v1/203fcc20-6152-4793-877d-124216f8fe4d/thumb_cosmic_wedding.png',
    '/__l5e/assets-v1/203fcc20-6152-4793-877d-124216f8fe4d/thumb_cosmic_wedding.png',
    '/__l5e/assets-v1/0a622b28-5cb3-443e-8f61-af097a0572b1/gift_cosmic_wedding.mp4',
    'mp4', 'fullscreen', true, true);
