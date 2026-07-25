-- Jalwa Universe Spaceship — premium fullscreen luxury gift
-- Transparent WebM (VP9 alpha) + PNG thumbnail served from Lovable CDN.

INSERT INTO public.gifts (
  name, emoji, price, price_coins, category, animation,
  sort_order, is_active, active,
  icon, image_url, clip_path, clip_type, diamonds_value
) VALUES (
  'Jalwa Universe Spaceship',
  '🚀',
  199,
  199,
  'luxury',
  'fullscreen',
  10,
  true,
  true,
  '/__l5e/assets-v1/1dd43b61-cb94-490b-bf48-a183610ae474/jalwa-spaceship.png',
  '/__l5e/assets-v1/1dd43b61-cb94-490b-bf48-a183610ae474/jalwa-spaceship.png',
  '/__l5e/assets-v1/d007d8f0-a97a-4676-80da-898d3c2e9b10/jalwa-spaceship.webm',
  'webm',
  199
)
ON CONFLICT DO NOTHING;
