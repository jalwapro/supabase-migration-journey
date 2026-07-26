-- Batch 1: 10 premium/luxury/VIP gifts (5k - 100k coins) with cinematic MP4 animations.
DO $$
DECLARE
  gift_names text[] := ARRAY[
    'Jalwa Diamond Waterfall',
    'Jalwa Golden Peacock',
    'Jalwa Royal Elephant',
    'Jalwa Cherry Blossom',
    'Jalwa Phoenix Rising',
    'Jalwa Crystal Chandelier',
    'Jalwa Speed Racer',
    'Jalwa Private Jet',
    'Jalwa Diamond Ring',
    'Jalwa Golden Dragon'
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
  ('Jalwa Diamond Waterfall', 'vip', 5000, 5000, 5000,
    '/__l5e/assets-v1/659b3193-f62a-4a24-9657-73a4928bed26/thumb_diamond_waterfall.png',
    '/__l5e/assets-v1/659b3193-f62a-4a24-9657-73a4928bed26/thumb_diamond_waterfall.png',
    '/__l5e/assets-v1/659b3193-f62a-4a24-9657-73a4928bed26/thumb_diamond_waterfall.png',
    '/__l5e/assets-v1/a7dd1dda-a8f8-4b54-b701-2f0a9943a05a/gift_diamond_waterfall.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Golden Peacock', 'vip', 8000, 8000, 8000,
    '/__l5e/assets-v1/3edede2c-a5a0-48b3-9b90-355a25c5abe4/thumb_golden_peacock.png',
    '/__l5e/assets-v1/3edede2c-a5a0-48b3-9b90-355a25c5abe4/thumb_golden_peacock.png',
    '/__l5e/assets-v1/3edede2c-a5a0-48b3-9b90-355a25c5abe4/thumb_golden_peacock.png',
    '/__l5e/assets-v1/e8064b04-b2ef-4499-bf98-a9260396cb9b/gift_golden_peacock.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Royal Elephant', 'vip', 12000, 12000, 12000,
    '/__l5e/assets-v1/2a8702e0-6235-4414-bf3e-ea92a807fd49/thumb_royal_elephant.png',
    '/__l5e/assets-v1/2a8702e0-6235-4414-bf3e-ea92a807fd49/thumb_royal_elephant.png',
    '/__l5e/assets-v1/2a8702e0-6235-4414-bf3e-ea92a807fd49/thumb_royal_elephant.png',
    '/__l5e/assets-v1/69408dfd-5beb-4148-affe-bfd70d005895/gift_royal_elephant.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Cherry Blossom', 'vip', 15000, 15000, 15000,
    '/__l5e/assets-v1/3f966d3e-bef7-40a1-9367-7a4bc484e928/thumb_cherry_blossom_rain.png',
    '/__l5e/assets-v1/3f966d3e-bef7-40a1-9367-7a4bc484e928/thumb_cherry_blossom_rain.png',
    '/__l5e/assets-v1/3f966d3e-bef7-40a1-9367-7a4bc484e928/thumb_cherry_blossom_rain.png',
    '/__l5e/assets-v1/c44fd17d-6f3b-40eb-8e4e-72dbfc2eb82a/gift_cherry_blossom_rain.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Phoenix Rising', 'vip', 25000, 25000, 25000,
    '/__l5e/assets-v1/f323307d-ac34-4802-9d45-8dd59d939fdc/thumb_phoenix_rising.png',
    '/__l5e/assets-v1/f323307d-ac34-4802-9d45-8dd59d939fdc/thumb_phoenix_rising.png',
    '/__l5e/assets-v1/f323307d-ac34-4802-9d45-8dd59d939fdc/thumb_phoenix_rising.png',
    '/__l5e/assets-v1/6367a593-6021-4033-9274-82d1c60095ce/gift_phoenix_rising.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Crystal Chandelier', 'vip', 35000, 35000, 35000,
    '/__l5e/assets-v1/06634a2b-1056-454f-8885-dc891db090ae/thumb_crystal_chandelier.png',
    '/__l5e/assets-v1/06634a2b-1056-454f-8885-dc891db090ae/thumb_crystal_chandelier.png',
    '/__l5e/assets-v1/06634a2b-1056-454f-8885-dc891db090ae/thumb_crystal_chandelier.png',
    '/__l5e/assets-v1/7143d46d-18ec-444e-acbc-990585b36a92/gift_crystal_chandelier.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Speed Racer', 'vip', 45000, 45000, 45000,
    '/__l5e/assets-v1/a80f172e-1ea9-4e0c-ae4d-e7d345ecc37c/thumb_sports_car.png',
    '/__l5e/assets-v1/a80f172e-1ea9-4e0c-ae4d-e7d345ecc37c/thumb_sports_car.png',
    '/__l5e/assets-v1/a80f172e-1ea9-4e0c-ae4d-e7d345ecc37c/thumb_sports_car.png',
    '/__l5e/assets-v1/9b6f499e-7a16-4a64-8b24-14e2f0767e3d/gift_sports_car.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Private Jet', 'vip', 60000, 60000, 60000,
    '/__l5e/assets-v1/a289d401-a631-4751-bb2d-65d7761484d4/thumb_private_jet.png',
    '/__l5e/assets-v1/a289d401-a631-4751-bb2d-65d7761484d4/thumb_private_jet.png',
    '/__l5e/assets-v1/a289d401-a631-4751-bb2d-65d7761484d4/thumb_private_jet.png',
    '/__l5e/assets-v1/bf204b66-dbd4-4a4b-b838-57614429feca/gift_private_jet.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Diamond Ring', 'vip', 80000, 80000, 80000,
    '/__l5e/assets-v1/4d1ce60d-99fa-4ddb-b91f-a2ac45172a1a/thumb_diamond_ring.png',
    '/__l5e/assets-v1/4d1ce60d-99fa-4ddb-b91f-a2ac45172a1a/thumb_diamond_ring.png',
    '/__l5e/assets-v1/4d1ce60d-99fa-4ddb-b91f-a2ac45172a1a/thumb_diamond_ring.png',
    '/__l5e/assets-v1/343945b9-70ef-4166-8edf-22925bb9fa12/gift_diamond_ring.mp4',
    'mp4', 'fullscreen', true, true),
  ('Jalwa Golden Dragon', 'vip', 100000, 100000, 100000,
    '/__l5e/assets-v1/6c3791e1-8f54-4551-8971-35cd15249e88/thumb_golden_dragon.png',
    '/__l5e/assets-v1/6c3791e1-8f54-4551-8971-35cd15249e88/thumb_golden_dragon.png',
    '/__l5e/assets-v1/6c3791e1-8f54-4551-8971-35cd15249e88/thumb_golden_dragon.png',
    '/__l5e/assets-v1/b449ee60-9f4d-425c-9277-99833635ab02/gift_golden_dragon.mp4',
    'mp4', 'fullscreen', true, true);
