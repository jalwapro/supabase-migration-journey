-- Add 3 more animated (alpha WebM) DP frames — v2 with empty transparent center.
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
   'Live animated golden lion crown frame with ruby jewels',
   '/__l5e/assets-v1/f1b65c80-2287-4de8-8cfb-dc7d3b991381/frame-lion-crown.webm',
   70000, 7000),
  ('Diamond Ice Live',
   'Live animated sapphire and diamond ring frame',
   '/__l5e/assets-v1/2726643a-6404-485f-90e0-96b9653f629b/frame-diamond-ice.webm',
   70000, 7000),
  ('Angel Wings Live',
   'Live animated golden angel wings with divine halo',
   '/__l5e/assets-v1/1364affa-cb4e-4098-9c50-3106a3bfd407/frame-angel-wings.webm',
   70000, 7000)
) AS v(name, description, url, price, diamonds)
ON CONFLICT DO NOTHING;

-- If already inserted with old URLs (v1), refresh them:
UPDATE public.themes SET animation_url = '/__l5e/assets-v1/f1b65c80-2287-4de8-8cfb-dc7d3b991381/frame-lion-crown.webm',
                         preview_url   = '/__l5e/assets-v1/f1b65c80-2287-4de8-8cfb-dc7d3b991381/frame-lion-crown.webm'
 WHERE name = 'Lion Crown Live';
UPDATE public.themes SET animation_url = '/__l5e/assets-v1/2726643a-6404-485f-90e0-96b9653f629b/frame-diamond-ice.webm',
                         preview_url   = '/__l5e/assets-v1/2726643a-6404-485f-90e0-96b9653f629b/frame-diamond-ice.webm'
 WHERE name = 'Diamond Ice Live';
UPDATE public.themes SET animation_url = '/__l5e/assets-v1/1364affa-cb4e-4098-9c50-3106a3bfd407/frame-angel-wings.webm',
                         preview_url   = '/__l5e/assets-v1/1364affa-cb4e-4098-9c50-3106a3bfd407/frame-angel-wings.webm'
 WHERE name = 'Angel Wings Live';
