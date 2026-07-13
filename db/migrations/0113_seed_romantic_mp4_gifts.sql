-- Seed the "romantic" gift category with cinematic MP4 clips (026-050).
-- Idempotent: replace by name.

DELETE FROM public.gifts WHERE category = 'romantic';

INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation, clip_path, clip_type, image_url, sort_order, is_active, active)
VALUES
  ('Diamond Rose',       '🌹', '🌹',    29,    29,    29, 'romantic', 'cinematic', '/__l5e/assets-v1/607c0b54-175d-49a8-8852-db33446e1a30/026-diamond-rose.mp4',      'mp4', NULL, 26, true, true),
  ('Love Letter',        '💌', '💌',    39,    39,    39, 'romantic', 'cinematic', '/__l5e/assets-v1/c55c9602-b387-49e6-91eb-480984c620be/027-love-letter.mp4',       'mp4', NULL, 27, true, true),
  ('Crystal Heart Box',  '💝', '💝',    49,    49,    49, 'romantic', 'cinematic', '/__l5e/assets-v1/841c882c-3c9b-4605-bade-4bc7a8518434/028-crystal-heart-box.mp4', 'mp4', NULL, 28, true, true),
  ('Teddy Couple',       '🧸', '🧸',    59,    59,    59, 'romantic', 'cinematic', '/__l5e/assets-v1/1ad1e380-829e-4f83-a304-83a50a55e4ff/029-teddy-couple.mp4',      'mp4', NULL, 29, true, true),
  ('Kiss Balloon',       '💋', '💋',    69,    69,    69, 'romantic', 'cinematic', '/__l5e/assets-v1/fb18d3d2-f589-4c3a-a6f2-8864b5467733/030-kiss-balloon.mp4',      'mp4', NULL, 30, true, true),
  ('Cupid Arrow',        '🏹', '🏹',    79,    79,    79, 'romantic', 'cinematic', '/__l5e/assets-v1/81bcdb1f-9453-47af-adc1-75b64c1e9e97/031-cupid-arrow.mp4',       'mp4', NULL, 31, true, true),
  ('Heart Lock',         '🔐', '🔐',    99,    99,    99, 'romantic', 'cinematic', '/__l5e/assets-v1/2742a42c-e36f-4ed8-8418-3b093b50f835/032-heart-lock.mp4',        'mp4', NULL, 32, true, true),
  ('Love Bridge',        '🌉', '🌉',   129,   129,   129, 'romantic', 'cinematic', '/__l5e/assets-v1/2321835a-9724-4e8d-bddb-e4fbcdf14ca0/033-love-bridge.mp4',       'mp4', NULL, 33, true, true),
  ('Swan Couple',        '🦢', '🦢',   159,   159,   159, 'romantic', 'cinematic', '/__l5e/assets-v1/219bcb10-a9df-4c03-92a8-05ef2ed7324b/034-swan-couple.mp4',       'mp4', NULL, 34, true, true),
  ('Romantic Moon',      '🌙', '🌙',   199,   199,   199, 'romantic', 'cinematic', '/__l5e/assets-v1/bd6ee88d-f57f-41d7-9143-4ce49b703ad2/035-romantic-moon.mp4',     'mp4', NULL, 35, true, true),
  ('Heart Fountain',     '⛲', '⛲',   299,   299,   299, 'romantic', 'cinematic', '/__l5e/assets-v1/2e0edc55-ef3b-42d8-ba2c-83f9f2cb2619/036-heart-fountain.mp4',    'mp4', NULL, 36, true, true),
  ('Love Garden',        '🌷', '🌷',   399,   399,   399, 'romantic', 'cinematic', '/__l5e/assets-v1/7be55efe-285a-418b-850d-c6e4513a2ab7/037-love-garden.mp4',      'mp4', NULL, 37, true, true),
  ('Diamond Ring Box',   '💍', '💍',   499,   499,   499, 'romantic', 'cinematic', '/__l5e/assets-v1/5871c98e-d366-4aa1-86be-6e54dd7a0a70/038-diamond-ring-box.mp4',  'mp4', NULL, 38, true, true),
  ('Royal Proposal',     '👑', '👑',   599,   599,   599, 'romantic', 'cinematic', '/__l5e/assets-v1/d1959fd1-43cf-43a9-9d6c-da2f3cd39aa9/039-royal-proposal.mp4',    'mp4', NULL, 39, true, true),
  ('Cupid Wings',        '👼', '👼',   699,   699,   699, 'romantic', 'cinematic', '/__l5e/assets-v1/c67dfc00-6d9e-472e-acd8-c73f4e880b55/040-cupid-wings.mp4',       'mp4', NULL, 40, true, true),
  ('Crystal Castle',     '🏰', '🏰',   799,   799,   799, 'romantic', 'cinematic', '/__l5e/assets-v1/f175d5cd-a2df-4da0-8470-e3114e210ee8/041-crystal-castle.mp4',    'mp4', NULL, 41, true, true),
  ('Love Boat',          '⛵', '⛵',   999,   999,   999, 'romantic', 'cinematic', '/__l5e/assets-v1/0ed27289-e7e4-4ccd-9d7d-baab3e13ed8b/042-love-boat.mp4',         'mp4', NULL, 42, true, true),
  ('Luxury Perfume',     '🌸', '🌸',  1299,  1299,  1299, 'romantic', 'cinematic', '/__l5e/assets-v1/10571689-d8a5-44a4-97d6-a2f26386ee85/043-luxury-perfume.mp4',    'mp4', NULL, 43, true, true),
  ('Wedding Bouquet',    '💐', '💐',  1599,  1599,  1599, 'romantic', 'cinematic', '/__l5e/assets-v1/6c6e227d-136c-46c5-8708-98124dd3d67d/044-wedding-bouquet.mp4',   'mp4', NULL, 44, true, true),
  ('Romantic Fireworks', '🎆', '🎆',  1999,  1999,  1999, 'romantic', 'cinematic', '/__l5e/assets-v1/9a822503-779b-4ebf-b63c-f96f2dcecf06/045-romantic-fireworks.mp4','mp4', NULL, 45, true, true),
  ('Heart Palace',       '🏯', '🏯',  2499,  2499,  2499, 'romantic', 'cinematic', '/__l5e/assets-v1/02eeefff-b5cf-4b0e-8b68-edd83b7dc889/046-heart-palace.mp4',      'mp4', NULL, 46, true, true),
  ('Eternal Love Tree',  '🌳', '🌳',  2999,  2999,  2999, 'romantic', 'cinematic', '/__l5e/assets-v1/8940b790-69f0-418f-a0cc-b9b4e219a266/047-eternal-love-tree.mp4', 'mp4', NULL, 47, true, true),
  ('Golden Pegasus',     '🦄', '🦄',  3999,  3999,  3999, 'romantic', 'cinematic', '/__l5e/assets-v1/d826db6a-1a00-487d-bd2b-5a9b35dea9d3/048-golden-pegasus.mp4',    'mp4', NULL, 48, true, true),
  ('Heaven of Love',     '☁️', '☁️',  4999,  4999,  4999, 'romantic', 'cinematic', '/__l5e/assets-v1/3ce9a09d-f912-4afb-8327-c2f0a35f3f45/049-heaven-of-love.mp4',   'mp4', NULL, 49, true, true),
  ('Infinity Love',      '♾️', '♾️',  9999,  9999,  9999, 'romantic', 'cinematic', '/__l5e/assets-v1/bbb5f65f-63c6-46d9-83bd-54e0c6b4f5cc/050-infinity-love.mp4',    'mp4', NULL, 50, true, true);
