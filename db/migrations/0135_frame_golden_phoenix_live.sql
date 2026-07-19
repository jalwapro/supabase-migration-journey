INSERT INTO public.themes
  (name, description, category_id, animation_url, preview_url,
   price, price_diamonds, duration_days, is_premium, is_active, sort, is_free)
SELECT 'Golden Phoenix Live',
       'Live animated golden phoenix wings + fire crown frame',
       (SELECT id FROM public.theme_categories WHERE slug='frame'),
       '/__l5e/assets-v1/b17696dc-8ded-49e8-af08-95eabcd23b9e/frame-phoenix-gold.webm',
       '/__l5e/assets-v1/b17696dc-8ded-49e8-af08-95eabcd23b9e/frame-phoenix-gold.webm',
       70000, 7000, 30, true, true, 0, false
WHERE NOT EXISTS (SELECT 1 FROM public.themes WHERE name='Golden Phoenix Live');
