-- Add Jalwa Premium Gifts Collection (Teddy Bear, Diamond Ring, Golden Dragon, King Throne)
-- Idempotent inserts by unique name.

INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation, clip_path, clip_type, sort_order, is_active, active)
VALUES
  ('Teddy Bear',    '🧸', '🧸', 100,  100,  100,  'love',    'float',  '/animations/gifts/heart-burst.svg',     'svg', 7,  true, true),
  ('Diamond Ring',  '💍', '💍', 300,  300,  300,  'luxury',  'sparkle','/animations/gifts/diamond-sparkle.svg', 'svg', 6,  true, true),
  ('Golden Dragon', '🐉', '🐉', 4999, 4999, 4999, 'vip',     'flame',  '/animations/gifts/phoenix.svg',         'svg', 8,  true, true),
  ('King Throne',   '👑', '👑', 9999, 9999, 9999, 'vip',     'shine',  '/animations/gifts/crown-shine.svg',     'svg', 9,  true, true)
ON CONFLICT DO NOTHING;

-- Align existing gifts' diamond values with the premium collection reference card.
UPDATE public.gifts SET diamonds_value = 10   WHERE name = 'Rose'       AND diamonds_value <> 10;
UPDATE public.gifts SET diamonds_value = 30   WHERE name = 'Heart'      AND diamonds_value <> 30;
UPDATE public.gifts SET diamonds_value = 50   WHERE name = 'Kiss'       AND diamonds_value <> 50;
UPDATE public.gifts SET diamonds_value = 999  WHERE name = 'Sports Car' AND diamonds_value <> 999;
UPDATE public.gifts SET diamonds_value = 1999 WHERE name = 'Yacht'      AND diamonds_value <> 1999;
