-- Add 12 premium MP4 gift clips. Editable from admin panel.
-- Idempotent by unique name.

INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation, clip_path, clip_type, sort_order, is_active, active)
VALUES
  ('Love Balloons',  '🎈', '🎈',   50,    50,    30,    'love',    'float',  '/__l5e/assets-v1/7e23e8d5-da09-4689-9d72-ce650ad6e34b/01_love_balloons.mp4',  'mp4', 10, true, true),
  ('Chocolate Box',  '🍫', '🍫',   100,   100,   60,    'love',    'pop',    '/__l5e/assets-v1/67eb243a-d7c6-4f68-b7d5-4c1ffec4ab0d/02_chocolate_box.mp4',  'mp4', 11, true, true),
  ('Birthday Cake',  '🎂', '🎂',   150,   150,   90,    'classic', 'pop',    '/__l5e/assets-v1/638dddd1-0e27-483e-ac31-f49e653f89c9/03_cake.mp4',           'mp4', 10, true, true),
  ('Magic Wand',     '🪄', '🪄',   200,   200,   120,   'popular', 'sparkle','/__l5e/assets-v1/6b99b2ad-5673-46b6-a774-a27e14a81e09/04_magic_wand.mp4',     'mp4', 10, true, true),
  ('Coffee Cup',     '☕', '☕',   30,    30,    18,    'popular', 'pop',    '/__l5e/assets-v1/dfc79256-0c55-4a66-bb71-8ca0045f6ea5/05_coffee_cup.mp4',     'mp4', 11, true, true),
  ('Ice Cream',      '🍦', '🍦',   20,    20,    12,    'popular', 'pop',    '/__l5e/assets-v1/8911b028-422b-4568-9d0c-6d991b186d0b/06_ice_cream.mp4',      'mp4', 12, true, true),
  ('Ring',           '💍', '💍',   500,   500,   300,   'luxury',  'sparkle','/__l5e/assets-v1/14abff1b-436a-44c0-b31d-76fb4ec70e76/07_ring.mp4',           'mp4', 10, true, true),
  ('Ferrari',        '🏎️','🏎️',  5000,  5000,  3000,  'luxury',  'zoom',   '/__l5e/assets-v1/fe6d783c-eef6-4766-a044-b0cb7a55b398/08_ferrari.mp4',        'mp4', 11, true, true),
  ('Private Jet',    '🛩️','🛩️',  15000, 15000, 9000,  'vip',     'launch', '/__l5e/assets-v1/ab6c61b7-dba6-4c22-b4af-bf927be1ffde/09_private_jet.mp4',    'mp4', 10, true, true),
  ('Luxury Yacht',   '🛥️','🛥️',  10000, 10000, 6000,  'luxury',  'slide',  '/__l5e/assets-v1/47304af6-75df-4ef8-9627-b4d11f11a57b/10_yacht.mp4',          'mp4', 12, true, true),
  ('Helicopter',     '🚁', '🚁',   8000,  8000,  4800,  'vip',     'launch', '/__l5e/assets-v1/083d789e-a775-4923-a2b1-d2bd624b55bf/11_helicopter.mp4',    'mp4', 11, true, true),
  ('Mighty Dragon',  '🐲', '🐲',   20000, 20000, 12000, 'vip',     'flame',  '/__l5e/assets-v1/b11634b2-4e10-4517-b513-8ccb45d4d66d/12_golden_dragon.mp4', 'mp4', 12, true, true)
ON CONFLICT DO NOTHING;
