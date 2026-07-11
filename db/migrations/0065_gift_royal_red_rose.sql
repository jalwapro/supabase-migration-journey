-- Royal Red Rose — first entry in the fresh premium gift collection.
INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation, clip_path, clip_type, image_url, sort_order, is_active, active)
VALUES
  (
    'Royal Red Rose', '🌹', '🌹',
    99, 99, 99,
    'love', 'bloom',
    'https://cloud-to-soul.lovable.app/__l5e/assets-v1/42dd4376-6726-47f1-95a3-6a8629f4ceb2/royal_red_rose.alpha.webm',
    'webm',
    'https://cloud-to-soul.lovable.app/__l5e/assets-v1/c314a60b-ae3c-4392-a4eb-2259f16913ba/royal_red_rose.png',
    1, true, true
  )
ON CONFLICT DO NOTHING;
