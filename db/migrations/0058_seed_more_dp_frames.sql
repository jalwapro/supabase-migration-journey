-- Seed 5 additional realistic DP frames into the shop under the "Frame" category.
-- Idempotent: uses name-based update to keep preview/animation URLs current.

do $$
declare
  _frame_cat uuid;
begin
  select id into _frame_cat from public.theme_categories where slug = 'frame' limit 1;
  if _frame_cat is null then
    insert into public.theme_categories (name, slug, sort_order, is_active)
      values ('Frame', 'frame', 2, true)
      returning id into _frame_cat;
  end if;

  -- Emerald Dragon
  insert into public.themes
    (name, description, is_free, price, price_diamonds, duration_days,
     bg_image, primary_color, accent_color, sort, is_active,
     category_id, preview_url, animation_url, is_premium)
  values
    ('Emerald Dragon Frame', 'Twin golden dragons with jade scales',
     false, 0, 3299, 30,
     null, '#37c07a', '#0a5a3a', 5, true,
     _frame_cat,
     '/__l5e/assets-v1/1d2e83a4-d5be-410c-bdaf-23e941a68cfa/frame-dragon.png',
     '/__l5e/assets-v1/1d2e83a4-d5be-410c-bdaf-23e941a68cfa/frame-dragon.png',
     true)
  on conflict do nothing;

  update public.themes set
    category_id = _frame_cat,
    preview_url = '/__l5e/assets-v1/1d2e83a4-d5be-410c-bdaf-23e941a68cfa/frame-dragon.png',
    animation_url = '/__l5e/assets-v1/1d2e83a4-d5be-410c-bdaf-23e941a68cfa/frame-dragon.png',
    price_diamonds = 3299, duration_days = 30, is_premium = true, is_active = true,
    primary_color = '#37c07a', accent_color = '#0a5a3a'
  where name = 'Emerald Dragon Frame';

  -- Galaxy Nebula
  insert into public.themes
    (name, description, is_free, price, price_diamonds, duration_days,
     bg_image, primary_color, accent_color, sort, is_active,
     category_id, preview_url, animation_url, is_premium)
  values
    ('Galaxy Nebula Frame', 'Cosmic swirl with silver moon and comets',
     false, 0, 2799, 30,
     null, '#8b6cff', '#1b1050', 6, true,
     _frame_cat,
     '/__l5e/assets-v1/35877668-ccbe-4d68-aa21-d075367d752f/frame-galaxy.png',
     '/__l5e/assets-v1/35877668-ccbe-4d68-aa21-d075367d752f/frame-galaxy.png',
     true)
  on conflict do nothing;

  update public.themes set
    category_id = _frame_cat,
    preview_url = '/__l5e/assets-v1/35877668-ccbe-4d68-aa21-d075367d752f/frame-galaxy.png',
    animation_url = '/__l5e/assets-v1/35877668-ccbe-4d68-aa21-d075367d752f/frame-galaxy.png',
    price_diamonds = 2799, duration_days = 30, is_premium = true, is_active = true,
    primary_color = '#8b6cff', accent_color = '#1b1050'
  where name = 'Galaxy Nebula Frame';

  -- Cyber Neon
  insert into public.themes
    (name, description, is_free, price, price_diamonds, duration_days,
     bg_image, primary_color, accent_color, sort, is_active,
     category_id, preview_url, animation_url, is_premium)
  values
    ('Cyber Neon Frame', 'Electric blue and hot pink futurist circuits',
     false, 0, 2299, 30,
     null, '#ff3ec8', '#00c8ff', 7, true,
     _frame_cat,
     '/__l5e/assets-v1/a977337e-f4a6-4360-9bed-39a1ae822395/frame-cyber.png',
     '/__l5e/assets-v1/a977337e-f4a6-4360-9bed-39a1ae822395/frame-cyber.png',
     true)
  on conflict do nothing;

  update public.themes set
    category_id = _frame_cat,
    preview_url = '/__l5e/assets-v1/a977337e-f4a6-4360-9bed-39a1ae822395/frame-cyber.png',
    animation_url = '/__l5e/assets-v1/a977337e-f4a6-4360-9bed-39a1ae822395/frame-cyber.png',
    price_diamonds = 2299, duration_days = 30, is_premium = true, is_active = true,
    primary_color = '#ff3ec8', accent_color = '#00c8ff'
  where name = 'Cyber Neon Frame';

  -- Sakura Blossom
  insert into public.themes
    (name, description, is_free, price, price_diamonds, duration_days,
     bg_image, primary_color, accent_color, sort, is_active,
     category_id, preview_url, animation_url, is_premium)
  values
    ('Sakura Blossom Frame', 'Cherry blossoms with butterflies and pearls',
     false, 0, 1799, 30,
     null, '#ffb6d5', '#a04d76', 8, true,
     _frame_cat,
     '/__l5e/assets-v1/a944e2e3-8745-40ba-894a-2535815c1d26/frame-sakura.png',
     '/__l5e/assets-v1/a944e2e3-8745-40ba-894a-2535815c1d26/frame-sakura.png',
     true)
  on conflict do nothing;

  update public.themes set
    category_id = _frame_cat,
    preview_url = '/__l5e/assets-v1/a944e2e3-8745-40ba-894a-2535815c1d26/frame-sakura.png',
    animation_url = '/__l5e/assets-v1/a944e2e3-8745-40ba-894a-2535815c1d26/frame-sakura.png',
    price_diamonds = 1799, duration_days = 30, is_premium = true, is_active = true,
    primary_color = '#ffb6d5', accent_color = '#a04d76'
  where name = 'Sakura Blossom Frame';

  -- Diamond Ice
  insert into public.themes
    (name, description, is_free, price, price_diamonds, duration_days,
     bg_image, primary_color, accent_color, sort, is_active,
     category_id, preview_url, animation_url, is_premium)
  values
    ('Diamond Ice Frame', 'Brilliant blue diamonds on silver crystal',
     false, 0, 3799, 30,
     null, '#7cc8ff', '#1e4a80', 9, true,
     _frame_cat,
     '/__l5e/assets-v1/e5af42d5-c006-4f9b-8eb0-b7de41bbd172/frame-diamond.png',
     '/__l5e/assets-v1/e5af42d5-c006-4f9b-8eb0-b7de41bbd172/frame-diamond.png',
     true)
  on conflict do nothing;

  update public.themes set
    category_id = _frame_cat,
    preview_url = '/__l5e/assets-v1/e5af42d5-c006-4f9b-8eb0-b7de41bbd172/frame-diamond.png',
    animation_url = '/__l5e/assets-v1/e5af42d5-c006-4f9b-8eb0-b7de41bbd172/frame-diamond.png',
    price_diamonds = 3799, duration_days = 30, is_premium = true, is_active = true,
    primary_color = '#7cc8ff', accent_color = '#1e4a80'
  where name = 'Diamond Ice Frame';
end $$;
