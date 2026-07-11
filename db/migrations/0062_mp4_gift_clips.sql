-- Add 12 premium MP4 gift clips. Editable from admin panel.
-- Idempotent by unique name.

INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation, clip_path, clip_type, sort_order, is_active, active)
VALUES
  ('Love Balloons',  '🎈', '🎈',   50,    50,    30,    'love',    'float',  'https://cloud-to-soul.lovable.app/__l5e/assets-v1/47b937e7-64fb-4e41-933f-300a8460f72b/01_love_balloons.mp4',  'mp4', 10, true, true),
  ('Chocolate Box',  '🍫', '🍫',   100,   100,   60,    'love',    'pop',    'https://cloud-to-soul.lovable.app/__l5e/assets-v1/4563aaaf-15b4-442c-b464-d86c1d12cedf/02_chocolate_box.mp4',  'mp4', 11, true, true),
  ('Birthday Cake',  '🎂', '🎂',   150,   150,   90,    'classic', 'pop',    'https://cloud-to-soul.lovable.app/__l5e/assets-v1/86fff979-22d9-450d-a49a-903481e28172/03_cake.mp4',           'mp4', 10, true, true),
  ('Magic Wand',     '🪄', '🪄',   200,   200,   120,   'popular', 'sparkle','https://cloud-to-soul.lovable.app/__l5e/assets-v1/c239708b-a4b4-42e9-a155-3d1766af4e20/04_magic_wand.mp4',     'mp4', 10, true, true),
  ('Coffee Cup',     '☕', '☕',   30,    30,    18,    'popular', 'pop',    'https://cloud-to-soul.lovable.app/__l5e/assets-v1/c860f9c9-ee77-46b8-b29f-91c60e3d23a9/05_coffee_cup.mp4',     'mp4', 11, true, true),
  ('Ice Cream',      '🍦', '🍦',   20,    20,    12,    'popular', 'pop',    'https://cloud-to-soul.lovable.app/__l5e/assets-v1/17b1b3f4-6671-4c3a-b62f-989c2551e692/06_ice_cream.mp4',      'mp4', 12, true, true),
  ('Ring',           '💍', '💍',   500,   500,   300,   'luxury',  'sparkle','https://cloud-to-soul.lovable.app/__l5e/assets-v1/c2bddaaa-b357-473a-acc3-b80063b4a0b0/07_ring.mp4',           'mp4', 10, true, true),
  ('Ferrari',        '🏎️','🏎️',  5000,  5000,  3000,  'luxury',  'zoom',   'https://cloud-to-soul.lovable.app/__l5e/assets-v1/aaed9fda-d8d7-4c42-96b2-0c7e36f4250f/08_ferrari.mp4',        'mp4', 11, true, true),
  ('Private Jet',    '🛩️','🛩️',  15000, 15000, 9000,  'vip',     'launch', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/e6b9d581-60ef-4cb3-b20e-6c5b44633f8a/09_private_jet.mp4',    'mp4', 10, true, true),
  ('Luxury Yacht',   '🛥️','🛥️',  10000, 10000, 6000,  'luxury',  'slide',  'https://cloud-to-soul.lovable.app/__l5e/assets-v1/10c4a07b-349f-44f2-b98a-f1e228230987/10_yacht.mp4',          'mp4', 12, true, true),
  ('Helicopter',     '🚁', '🚁',   8000,  8000,  4800,  'vip',     'launch', 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/8d7de1a3-6ca7-4533-aaa7-f00d6c373e20/11_helicopter.mp4',    'mp4', 11, true, true),
  ('Mighty Dragon',  '🐲', '🐲',   20000, 20000, 12000, 'vip',     'flame',  'https://cloud-to-soul.lovable.app/__l5e/assets-v1/05adffb5-ef1c-428a-af8b-6e722c563e7c/12_golden_dragon.mp4', 'mp4', 12, true, true)
ON CONFLICT DO NOTHING;

UPDATE public.gifts SET clip_path = 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/47b937e7-64fb-4e41-933f-300a8460f72b/01_love_balloons.mp4', clip_type = 'mp4' WHERE name = 'Love Balloons';
UPDATE public.gifts SET clip_path = 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/4563aaaf-15b4-442c-b464-d86c1d12cedf/02_chocolate_box.mp4', clip_type = 'mp4' WHERE name = 'Chocolate Box';
UPDATE public.gifts SET clip_path = 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/86fff979-22d9-450d-a49a-903481e28172/03_cake.mp4', clip_type = 'mp4' WHERE name = 'Birthday Cake';
UPDATE public.gifts SET clip_path = 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/c239708b-a4b4-42e9-a155-3d1766af4e20/04_magic_wand.mp4', clip_type = 'mp4' WHERE name = 'Magic Wand';
UPDATE public.gifts SET clip_path = 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/c860f9c9-ee77-46b8-b29f-91c60e3d23a9/05_coffee_cup.mp4', clip_type = 'mp4' WHERE name = 'Coffee Cup';
UPDATE public.gifts SET clip_path = 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/17b1b3f4-6671-4c3a-b62f-989c2551e692/06_ice_cream.mp4', clip_type = 'mp4' WHERE name = 'Ice Cream';
UPDATE public.gifts SET clip_path = 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/c2bddaaa-b357-473a-acc3-b80063b4a0b0/07_ring.mp4', clip_type = 'mp4' WHERE name = 'Ring';
UPDATE public.gifts SET clip_path = 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/aaed9fda-d8d7-4c42-96b2-0c7e36f4250f/08_ferrari.mp4', clip_type = 'mp4' WHERE name = 'Ferrari';
UPDATE public.gifts SET clip_path = 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/e6b9d581-60ef-4cb3-b20e-6c5b44633f8a/09_private_jet.mp4', clip_type = 'mp4' WHERE name = 'Private Jet';
UPDATE public.gifts SET clip_path = 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/10c4a07b-349f-44f2-b98a-f1e228230987/10_yacht.mp4', clip_type = 'mp4' WHERE name = 'Luxury Yacht';
UPDATE public.gifts SET clip_path = 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/8d7de1a3-6ca7-4533-aaa7-f00d6c373e20/11_helicopter.mp4', clip_type = 'mp4' WHERE name = 'Helicopter';
UPDATE public.gifts SET clip_path = 'https://cloud-to-soul.lovable.app/__l5e/assets-v1/05adffb5-ef1c-428a-af8b-6e722c563e7c/12_golden_dragon.mp4', clip_type = 'mp4' WHERE name = 'Mighty Dragon';
