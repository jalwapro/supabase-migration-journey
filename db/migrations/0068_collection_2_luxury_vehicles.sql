-- Collection 2 — Luxury Vehicles (10 premium animated gifts)
-- Each gift has a transparent PNG shop icon + a 5s cinematic MP4 full-screen animation.

INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation, clip_path, clip_type, image_url, sort_order, is_active, active)
VALUES
  ('Bugatti Chiron', '🏎️', '🏎️', 3999, 3999, 3999, 'luxury', 'zoom',
   '/__l5e/assets-v1/eeb41c49-abcb-41e1-b732-593343a5b44d/c2_01_bugatti.mp4', 'mp4',
   '/__l5e/assets-v1/c3bbfbb8-6557-4ae9-bd71-e0ba7f433307/c2_01_bugatti.png',
   101, true, true),

  ('Rolls Royce Phantom', '🚗', '🚗', 4999, 4999, 4999, 'luxury', 'float',
   '/__l5e/assets-v1/3cc590c1-343d-402a-97f8-478e21c4db6e/c2_02_rollsroyce.mp4', 'mp4',
   '/__l5e/assets-v1/65d4e400-5c25-40a3-94a8-ebc586c15a3c/c2_02_rollsroyce.png',
   102, true, true),

  ('McLaren P1', '🏎️', '🏎️', 3499, 3499, 3499, 'luxury', 'zoom',
   '/__l5e/assets-v1/e4693e80-b269-4cf8-b61d-f5bdabfba5c8/c2_03_mclaren.mp4', 'mp4',
   '/__l5e/assets-v1/54e6946d-a8a9-4534-a6f1-11fae9d95d68/c2_03_mclaren.png',
   103, true, true),

  ('Mercedes G Wagon', '🚙', '🚙', 2999, 2999, 2999, 'luxury', 'zoom',
   '/__l5e/assets-v1/f75ac5b6-7a35-4ce3-afdd-d2c8b5e590b5/c2_04_gwagon.mp4', 'mp4',
   '/__l5e/assets-v1/72412493-5b6f-4263-82a8-ecf4fb4def2b/c2_04_gwagon.png',
   104, true, true),

  ('Tesla Cybertruck', '🛻', '🛻', 2799, 2799, 2799, 'luxury', 'zoom',
   '/__l5e/assets-v1/c23946b6-86d5-4642-aacf-43746a3df23b/c2_05_cybertruck.mp4', 'mp4',
   '/__l5e/assets-v1/01e3bb7e-cd58-4bc9-8268-b359f1fab040/c2_05_cybertruck.png',
   105, true, true),

  ('Ducati Panigale', '🏍️', '🏍️', 1799, 1799, 1799, 'luxury', 'zoom',
   '/__l5e/assets-v1/ceebcf36-93f3-4f74-9125-75f20b700e3d/c2_06_ducati.mp4', 'mp4',
   '/__l5e/assets-v1/b7b75c87-f824-473e-835a-68a5d923ca8c/c2_06_ducati.png',
   106, true, true),

  ('Harley Davidson', '🏍️', '🏍️', 1899, 1899, 1899, 'luxury', 'float',
   '/__l5e/assets-v1/6e980388-cd9d-46a6-ad93-dd65fddec7bd/c2_07_harley.mp4', 'mp4',
   '/__l5e/assets-v1/dc7e7b8a-1b39-4f7d-baae-74c0a5ff5abc/c2_07_harley.png',
   107, true, true),

  ('Formula 1 Car', '🏁', '🏁', 3299, 3299, 3299, 'luxury', 'zoom',
   '/__l5e/assets-v1/45f60061-a73b-45f0-b50a-c8dc4dd9733e/c2_08_f1.mp4', 'mp4',
   '/__l5e/assets-v1/b2f5f1a0-d440-424c-b442-c786a3e35127/c2_08_f1.png',
   108, true, true),

  ('Monster Truck', '🚚', '🚚', 1599, 1599, 1599, 'luxury', 'zoom',
   '/__l5e/assets-v1/7fbd9853-5353-4543-b5cb-f0a45ba2d5cf/c2_09_monstertruck.mp4', 'mp4',
   '/__l5e/assets-v1/0dbe5121-2d61-4515-81b8-05cb6577828c/c2_09_monstertruck.png',
   109, true, true),

  ('Police Supercar', '🚓', '🚓', 2199, 2199, 2199, 'luxury', 'zoom',
   '/__l5e/assets-v1/4098c6b8-739c-44bb-aa08-a5b788fa9508/c2_10_policecar.mp4', 'mp4',
   '/__l5e/assets-v1/dad13816-3b45-4ce7-954f-120b931d464f/c2_10_policecar.png',
   110, true, true);
