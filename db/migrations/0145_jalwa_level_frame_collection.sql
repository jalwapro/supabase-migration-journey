-- 0145: Jalwa Level 1–100 DP Frame Collection (10 series, PNG).
-- Adds the 10 official series frames to the shop and maps each to its level band.

WITH cat AS (
  SELECT id FROM public.theme_categories WHERE slug = 'frame'
)
INSERT INTO public.themes
  (name, description, category_id, animation_url, preview_url,
   price, price_diamonds, duration_days, is_premium, is_active, sort, is_free, min_level)
SELECT v.name, v.description, cat.id, v.url, v.url,
       v.price, v.diamonds, 30, true, true, v.sort, false, v.min_level
FROM cat, (VALUES
  ('Jalwa Celestial',       'Bronze to Gold — Level 1 to 10 series',
   '/__l5e/assets-v1/7ad6870c-e5aa-41b1-976c-c42e4d9e9cb9/frame-jalwa-celestial.png',
   10000, 1000, 1,  1),
  ('Jalwa Dragon',          'Silver Dragon Power — Level 11 to 20 series',
   '/__l5e/assets-v1/c63402c5-6fc3-4a69-91d7-2ec36d705a42/frame-jalwa-dragon.png',
   20000, 2000, 11, 2),
  ('Jalwa Phoenix',         'Phoenix Fire Rebirth — Level 21 to 30 series',
   '/__l5e/assets-v1/da785a22-626a-4be0-a19a-14e30119dcfc/frame-jalwa-phoenix.png',
   30000, 3000, 21, 3),
  ('Jalwa Lion King',       'Royal Lion Strength — Level 31 to 40 series',
   '/__l5e/assets-v1/842e4787-9afa-419b-a443-80551d2b0c7f/frame-jalwa-lion.png',
   40000, 4000, 31, 4),
  ('Jalwa Ocean King',      'Sapphire Ocean Power — Level 41 to 50 series',
   '/__l5e/assets-v1/77bdeb20-1485-4fcd-8a17-73b87d2ba46f/frame-jalwa-ocean.png',
   50000, 5000, 41, 5),
  ('Jalwa Galaxy',          'Cosmic Galaxy Energy — Level 51 to 60 series',
   '/__l5e/assets-v1/b17e3a01-7814-4204-a083-afeb8b4b2b30/frame-jalwa-galaxy.png',
   60000, 6000, 51, 6),
  ('Jalwa Diamond Emperor', 'Pure Diamond Dominance — Level 61 to 70 series',
   '/__l5e/assets-v1/56f76fc2-ec67-42b2-9e55-35bba58ce59c/frame-jalwa-diamond.png',
   70000, 7000, 61, 7),
  ('Jalwa Royal Palace',    'Royal Palace Luxury — Level 71 to 80 series',
   '/__l5e/assets-v1/c030c804-c4ff-4d59-b21a-5828122b5f71/frame-jalwa-palace.png',
   80000, 8000, 71, 8),
  ('Jalwa Legend King',     'Legendary King Power — Level 81 to 90 series',
   '/__l5e/assets-v1/0c508985-d369-41e2-a097-38dd814f697b/frame-jalwa-legend.png',
   90000, 9000, 81, 9),
  ('Jalwa CEO Emperor',     'Black & Gold Emperor — Level 91 to 100 series',
   '/__l5e/assets-v1/930b55a4-747b-40d4-8e2a-3da42391554f/frame-jalwa-ceo.png',
   100000, 10000, 91, 10)
) AS v(name, description, url, price, diamonds, min_level, sort)
ON CONFLICT DO NOTHING;

-- Refresh URLs / min_level if rows already exist.
UPDATE public.themes t SET
  animation_url = v.url, preview_url = v.url,
  min_level = v.min_level, is_active = true
FROM (VALUES
  ('Jalwa Celestial',       '/__l5e/assets-v1/7ad6870c-e5aa-41b1-976c-c42e4d9e9cb9/frame-jalwa-celestial.png', 1),
  ('Jalwa Dragon',          '/__l5e/assets-v1/c63402c5-6fc3-4a69-91d7-2ec36d705a42/frame-jalwa-dragon.png',    11),
  ('Jalwa Phoenix',         '/__l5e/assets-v1/da785a22-626a-4be0-a19a-14e30119dcfc/frame-jalwa-phoenix.png',   21),
  ('Jalwa Lion King',       '/__l5e/assets-v1/842e4787-9afa-419b-a443-80551d2b0c7f/frame-jalwa-lion.png',      31),
  ('Jalwa Ocean King',      '/__l5e/assets-v1/77bdeb20-1485-4fcd-8a17-73b87d2ba46f/frame-jalwa-ocean.png',     41),
  ('Jalwa Galaxy',          '/__l5e/assets-v1/b17e3a01-7814-4204-a083-afeb8b4b2b30/frame-jalwa-galaxy.png',    51),
  ('Jalwa Diamond Emperor', '/__l5e/assets-v1/56f76fc2-ec67-42b2-9e55-35bba58ce59c/frame-jalwa-diamond.png',   61),
  ('Jalwa Royal Palace',    '/__l5e/assets-v1/c030c804-c4ff-4d59-b21a-5828122b5f71/frame-jalwa-palace.png',    71),
  ('Jalwa Legend King',     '/__l5e/assets-v1/0c508985-d369-41e2-a097-38dd814f697b/frame-jalwa-legend.png',    81),
  ('Jalwa CEO Emperor',     '/__l5e/assets-v1/930b55a4-747b-40d4-8e2a-3da42391554f/frame-jalwa-ceo.png',       91)
) AS v(name, url, min_level)
WHERE t.name = v.name;
