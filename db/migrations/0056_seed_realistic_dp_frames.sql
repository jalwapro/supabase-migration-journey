-- Seed 4 realistic DP frames into the shop under the "Frame" category.
-- Idempotent: uses name-based conflict resolution and updates preview_url/animation_url.

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

  -- King
  insert into public.themes
    (name, description, is_free, price, price_diamonds, duration_days,
     bg_image, primary_color, accent_color, sort, is_active,
     category_id, preview_url, animation_url, is_premium)
  values
    ('Royal King Frame', 'Gold crown with flapping angel wings',
     false, 0, 2999, 30,
     null, '#f9d34a', '#8a5a10', 1, true,
     _frame_cat,
     '/__l5e/assets-v1/6ab72c1a-c1da-41cc-b6cc-872b24528d98/frame-king.png',
     '/__l5e/assets-v1/6ab72c1a-c1da-41cc-b6cc-872b24528d98/frame-king.png',
     true)
  on conflict do nothing;

  update public.themes set
    category_id = _frame_cat,
    preview_url = '/__l5e/assets-v1/6ab72c1a-c1da-41cc-b6cc-872b24528d98/frame-king.png',
    animation_url = '/__l5e/assets-v1/6ab72c1a-c1da-41cc-b6cc-872b24528d98/frame-king.png',
    price_diamonds = 2999, duration_days = 30, is_premium = true, is_active = true,
    primary_color = '#f9d34a', accent_color = '#8a5a10'
  where name = 'Royal King Frame';

  -- Queen
  insert into public.themes
    (name, description, is_free, price, price_diamonds, duration_days,
     bg_image, primary_color, accent_color, sort, is_active,
     category_id, preview_url, animation_url, is_premium)
  values
    ('Fairy Queen Frame', 'Rose gold tiara with butterfly wings',
     false, 0, 2499, 30,
     null, '#ff7ed0', '#7a1e63', 2, true,
     _frame_cat,
     '/__l5e/assets-v1/7e5db0f1-adb5-4dbb-ac89-3e03498b738a/frame-queen.png',
     '/__l5e/assets-v1/7e5db0f1-adb5-4dbb-ac89-3e03498b738a/frame-queen.png',
     true)
  on conflict do nothing;

  update public.themes set
    category_id = _frame_cat,
    preview_url = '/__l5e/assets-v1/7e5db0f1-adb5-4dbb-ac89-3e03498b738a/frame-queen.png',
    animation_url = '/__l5e/assets-v1/7e5db0f1-adb5-4dbb-ac89-3e03498b738a/frame-queen.png',
    price_diamonds = 2499, duration_days = 30, is_premium = true, is_active = true,
    primary_color = '#ff7ed0', accent_color = '#7a1e63'
  where name = 'Fairy Queen Frame';

  -- Wazeer
  insert into public.themes
    (name, description, is_free, price, price_diamonds, duration_days,
     bg_image, primary_color, accent_color, sort, is_active,
     category_id, preview_url, animation_url, is_premium)
  values
    ('Silver Wazeer Frame', 'Ornate silver crown with sapphires',
     false, 0, 1999, 30,
     null, '#cfe0f7', '#1e355e', 3, true,
     _frame_cat,
     '/__l5e/assets-v1/befbc51c-30ab-492a-95c5-d5430bf991f5/frame-wazeer.png',
     '/__l5e/assets-v1/befbc51c-30ab-492a-95c5-d5430bf991f5/frame-wazeer.png',
     true)
  on conflict do nothing;

  update public.themes set
    category_id = _frame_cat,
    preview_url = '/__l5e/assets-v1/befbc51c-30ab-492a-95c5-d5430bf991f5/frame-wazeer.png',
    animation_url = '/__l5e/assets-v1/befbc51c-30ab-492a-95c5-d5430bf991f5/frame-wazeer.png',
    price_diamonds = 1999, duration_days = 30, is_premium = true, is_active = true,
    primary_color = '#cfe0f7', accent_color = '#1e355e'
  where name = 'Silver Wazeer Frame';

  -- Phoenix
  insert into public.themes
    (name, description, is_free, price, price_diamonds, duration_days,
     bg_image, primary_color, accent_color, sort, is_active,
     category_id, preview_url, animation_url, is_premium)
  values
    ('Phoenix Fire Frame', 'Legendary phoenix with rising fire',
     false, 0, 3499, 30,
     null, '#ff6a1a', '#7a1a05', 4, true,
     _frame_cat,
     '/__l5e/assets-v1/53603aee-0862-4a66-bf9a-9a6ed93b20f5/frame-phoenix.png',
     '/__l5e/assets-v1/53603aee-0862-4a66-bf9a-9a6ed93b20f5/frame-phoenix.png',
     true)
  on conflict do nothing;

  update public.themes set
    category_id = _frame_cat,
    preview_url = '/__l5e/assets-v1/53603aee-0862-4a66-bf9a-9a6ed93b20f5/frame-phoenix.png',
    animation_url = '/__l5e/assets-v1/53603aee-0862-4a66-bf9a-9a6ed93b20f5/frame-phoenix.png',
    price_diamonds = 3499, duration_days = 30, is_premium = true, is_active = true,
    primary_color = '#ff6a1a', accent_color = '#7a1a05'
  where name = 'Phoenix Fire Frame';
end $$;
