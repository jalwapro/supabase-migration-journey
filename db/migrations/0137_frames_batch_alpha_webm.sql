-- Add 3 new transparent (alpha) WebM frames to the shop:
--   Phoenix Fire Live, Royal King Live, Emerald Dragon Live
-- These are the re-encoded, chromakeyed versions of the batch previews
-- (frame-*-alpha.webm, VP8/yuva420p) so they render correctly around avatars.

WITH cat AS (
  SELECT id FROM public.theme_categories WHERE slug = 'frame'
)
INSERT INTO public.themes
  (name, description, category_id, animation_url, preview_url,
   price, price_diamonds, duration_days, is_premium, is_active, sort, is_free)
SELECT v.name, v.description, cat.id, v.url, v.url,
       v.price, v.diamonds, 30, true, true, 0, false
FROM cat, (VALUES
  ('Phoenix Fire Live',
   'Live animated phoenix wings with crowned fire frame',
   '/__l5e/assets-v1/3a6a700c-980b-4b2d-912a-68a75b373fa5/frame-phoenix-fire.webm',
   70000, 7000),
  ('Royal King Live',
   'Live animated golden ornate crown frame with red jewels',
   '/__l5e/assets-v1/f7d2e2f1-7d01-4454-bf53-8fab86e07ec0/frame-royal-king.webm',
   70000, 7000),
  ('Emerald Dragon Live',
   'Live animated emerald dragon with flame frame',
   '/__l5e/assets-v1/615abe59-b89c-4d30-a210-51e368c87673/frame-emerald-dragon.webm',
   70000, 7000)
) AS v(name, description, url, price, diamonds)
WHERE NOT EXISTS (
  SELECT 1 FROM public.themes t WHERE t.name = v.name
);
