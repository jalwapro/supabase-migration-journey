-- Add 3 more animated (alpha WebM) DP frames to shop.
WITH cat AS (
  SELECT id FROM public.theme_categories WHERE slug = 'frame'
)
INSERT INTO public.themes
  (name, description, category_id, animation_url, preview_url,
   price, price_diamonds, duration_days, is_premium, is_active, sort, is_free)
SELECT v.name, v.description, cat.id, v.url, v.url,
       v.price, v.diamonds, 30, true, true, 0, false
FROM cat, (VALUES
  ('Lion Crown Live',
   'Live animated golden lion crown with ruby jewels',
   '/__l5e/assets-v1/fa4a6280-7eb2-4153-a120-b518ead20a2d/frame-lion-crown.webm',
   70000, 7000),
  ('Diamond Ice Live',
   'Live animated diamond crystal frame with sapphires',
   '/__l5e/assets-v1/49e4f373-62b3-4d00-8232-3f0a430c2439/frame-diamond-ice.webm',
   70000, 7000),
  ('Angel Wings Live',
   'Live animated golden angel wings with divine halo',
   '/__l5e/assets-v1/1398a9f0-68cf-4c93-8134-fbf03772205b/frame-angel-wings.webm',
   70000, 7000)
) AS v(name, description, url, price, diamonds)
WHERE NOT EXISTS (
  SELECT 1 FROM public.themes t WHERE t.name = v.name
);
