-- Fresh premium gift collection with transparent PNG assets for clean TikTok-style rendering.
DELETE FROM public.gift_sends;
DELETE FROM public.gifts;

INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation, clip_path, clip_type, image_url, sort_order, is_active, active)
VALUES
  ('Rose', '🌹', '🌹', 10, 10, 10, 'love', 'bloom', '/__l5e/assets-v1/f48d79f4-2d4f-4708-b9b4-c406d4c3ca0f/01_rose.png', 'png', '/__l5e/assets-v1/f48d79f4-2d4f-4708-b9b4-c406d4c3ca0f/01_rose.png', 1, true, true),
  ('Heart', '💖', '💖', 30, 30, 30, 'love', 'pulse', '/__l5e/assets-v1/caf69c08-d234-426d-ba20-37ba2bb121f6/02_heart.png', 'png', '/__l5e/assets-v1/caf69c08-d234-426d-ba20-37ba2bb121f6/02_heart.png', 2, true, true),
  ('Kiss', '💋', '💋', 50, 50, 50, 'love', 'pop', '/__l5e/assets-v1/86a9c5f5-7d7e-4a19-9ead-09ae194e38be/03_kiss.png', 'png', '/__l5e/assets-v1/86a9c5f5-7d7e-4a19-9ead-09ae194e38be/03_kiss.png', 3, true, true),
  ('Teddy Bear', '🧸', '🧸', 100, 100, 100, 'love', 'float', '/__l5e/assets-v1/f3e8a733-5c19-4af5-af3a-3a76c8bc1000/04_teddy.png', 'png', '/__l5e/assets-v1/f3e8a733-5c19-4af5-af3a-3a76c8bc1000/04_teddy.png', 4, true, true),
  ('Chocolate', '🍫', '🍫', 150, 150, 150, 'love', 'pop', '/__l5e/assets-v1/2f19147c-74e6-4e1b-a06d-2d0ace634c99/05_chocolate.png', 'png', '/__l5e/assets-v1/2f19147c-74e6-4e1b-a06d-2d0ace634c99/05_chocolate.png', 5, true, true),
  ('Cake', '🎂', '🎂', 199, 199, 199, 'party', 'sparkle', '/__l5e/assets-v1/ceeb8f63-4871-44b4-ad54-7bdcce65fbbf/06_cake.png', 'png', '/__l5e/assets-v1/ceeb8f63-4871-44b4-ad54-7bdcce65fbbf/06_cake.png', 6, true, true),
  ('Coffee Cup', '☕', '☕', 199, 199, 199, 'love', 'float', '/__l5e/assets-v1/302c92e9-fbe0-4c51-8c34-f2e849edf466/07_coffee.png', 'png', '/__l5e/assets-v1/302c92e9-fbe0-4c51-8c34-f2e849edf466/07_coffee.png', 7, true, true),
  ('Ice Cream', '🍦', '🍦', 299, 299, 299, 'fun', 'pop', '/__l5e/assets-v1/03d48ee4-2df6-4233-9ef0-81619d6f6ef4/08_icecream.png', 'png', '/__l5e/assets-v1/03d48ee4-2df6-4233-9ef0-81619d6f6ef4/08_icecream.png', 8, true, true),
  ('Ring', '💍', '💍', 399, 399, 399, 'luxury', 'sparkle', '/__l5e/assets-v1/39e31e7e-601d-43a0-8cb2-020379734fe2/09_ring.png', 'png', '/__l5e/assets-v1/39e31e7e-601d-43a0-8cb2-020379734fe2/09_ring.png', 9, true, true),
  ('Magic Wand', '🪄', '🪄', 499, 499, 499, 'magic', 'shine', '/__l5e/assets-v1/d3da1987-ea55-4446-9f3f-6a156246122c/10_magic_wand.png', 'png', '/__l5e/assets-v1/d3da1987-ea55-4446-9f3f-6a156246122c/10_magic_wand.png', 10, true, true),
  ('Balloons', '🎈', '🎈', 299, 299, 299, 'party', 'float', '/__l5e/assets-v1/c2cff0e5-27b2-419f-8810-e36930ff5989/11_balloons.png', 'png', '/__l5e/assets-v1/c2cff0e5-27b2-419f-8810-e36930ff5989/11_balloons.png', 11, true, true),
  ('Lamborghini', '🏎️', '🏎️', 1299, 1299, 1299, 'luxury', 'zoom', '/__l5e/assets-v1/9899a59d-a10c-43af-867a-30783da1db78/12_lambo.png', 'png', '/__l5e/assets-v1/9899a59d-a10c-43af-867a-30783da1db78/12_lambo.png', 12, true, true),
  ('Ferrari', '🏎️', '🏎️', 1299, 1299, 1299, 'luxury', 'zoom', '/__l5e/assets-v1/eaa36f25-4234-4803-b28b-72a052f870e1/13_ferrari.png', 'png', '/__l5e/assets-v1/eaa36f25-4234-4803-b28b-72a052f870e1/13_ferrari.png', 13, true, true),
  ('Private Jet', '✈️', '✈️', 1999, 1999, 1999, 'vip', 'fly', '/__l5e/assets-v1/cbd530e6-1f4a-42f6-b0bb-87d261e8545d/14_jet.png', 'png', '/__l5e/assets-v1/cbd530e6-1f4a-42f6-b0bb-87d261e8545d/14_jet.png', 14, true, true),
  ('Yacht', '🛥️', '🛥️', 1999, 1999, 1999, 'vip', 'float', '/__l5e/assets-v1/3e2ad7dc-e744-4ca8-80b7-b6bda97f349e/15_yacht.png', 'png', '/__l5e/assets-v1/3e2ad7dc-e744-4ca8-80b7-b6bda97f349e/15_yacht.png', 15, true, true),
  ('Helicopter', '🚁', '🚁', 1299, 1299, 1299, 'vip', 'fly', '/__l5e/assets-v1/919bb5ac-4371-4234-af91-76eb03e61988/16_helicopter.png', 'png', '/__l5e/assets-v1/919bb5ac-4371-4234-af91-76eb03e61988/16_helicopter.png', 16, true, true),
  ('Diamond', '💎', '💎', 2499, 2499, 2499, 'luxury', 'sparkle', '/__l5e/assets-v1/7294c072-4188-4fb7-9ea3-c7f77c89785e/17_diamond.png', 'png', '/__l5e/assets-v1/7294c072-4188-4fb7-9ea3-c7f77c89785e/17_diamond.png', 17, true, true),
  ('Crown', '👑', '👑', 2999, 2999, 2999, 'luxury', 'shine', '/__l5e/assets-v1/dc5d98f0-d479-4cba-a5bf-57dc7131830b/18_crown.png', 'png', '/__l5e/assets-v1/dc5d98f0-d479-4cba-a5bf-57dc7131830b/18_crown.png', 18, true, true),
  ('Golden Dragon', '🐉', '🐉', 4999, 4999, 4999, 'legendary', 'flame', '/__l5e/assets-v1/53d5fe99-c270-4c10-95a7-2bcae90ec8a3/19_golden_dragon.png', 'png', '/__l5e/assets-v1/53d5fe99-c270-4c10-95a7-2bcae90ec8a3/19_golden_dragon.png', 19, true, true),
  ('King Throne', '👑', '👑', 5999, 5999, 5999, 'mythic', 'shine', '/__l5e/assets-v1/242b9ecb-9d93-481d-96cb-a3220787502e/20_king_throne.png', 'png', '/__l5e/assets-v1/242b9ecb-9d93-481d-96cb-a3220787502e/20_king_throne.png', 20, true, true),
  ('Fireworks', '🎆', '🎆', 500, 500, 500, 'party', 'fireworks', '/__l5e/assets-v1/93d564cb-1d9e-4ca1-8818-ad9f26126d88/21_fireworks.png', 'png', '/__l5e/assets-v1/93d564cb-1d9e-4ca1-8818-ad9f26126d88/21_fireworks.png', 21, true, true),
  ('Flower Bouquet', '💐', '💐', 399, 399, 399, 'love', 'float', '/__l5e/assets-v1/20340c34-28b1-423f-9e58-909fb09bf82b/22_flower_bouquet.png', 'png', '/__l5e/assets-v1/20340c34-28b1-423f-9e58-909fb09bf82b/22_flower_bouquet.png', 22, true, true),
  ('Love Letter', '💌', '💌', 299, 299, 299, 'love', 'pop', '/__l5e/assets-v1/bb31c4ad-cadf-4545-bcfe-698e0e35463d/23_love_letter.png', 'png', '/__l5e/assets-v1/bb31c4ad-cadf-4545-bcfe-698e0e35463d/23_love_letter.png', 23, true, true),
  ('Rainbow', '🌈', '🌈', 399, 399, 399, 'magic', 'shine', '/__l5e/assets-v1/de4ce948-5072-4acf-b4e0-a20f9315ba4b/24_rainbow.png', 'png', '/__l5e/assets-v1/de4ce948-5072-4acf-b4e0-a20f9315ba4b/24_rainbow.png', 24, true, true),
  ('Starlight', '⭐', '⭐', 599, 599, 599, 'magic', 'shine', '/__l5e/assets-v1/8450f3dc-e86e-4177-b703-22f7ad065310/25_starlight.png', 'png', '/__l5e/assets-v1/8450f3dc-e86e-4177-b703-22f7ad065310/25_starlight.png', 25, true, true);
