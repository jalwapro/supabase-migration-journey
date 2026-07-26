-- 0216: 8 TikTok-style Jalwa premium gifts (500-3000 coins, pure SVG, transparent)
BEGIN;

INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation,
   clip_path, clip_type, image_url, sort_order, is_active, active, chromakey)
VALUES
  ('Diamond Rain',       '💎', '💎',  500,  500,  300, 'luxury',   'burst',
   '/animations/gifts/tiktok-jalwa/diamond-rain.svg',       'svg',
   '/animations/gifts/tiktok-jalwa/diamond-rain.svg',       9101, true, true, 'none'),
  ('Neon Heart Burst',   '💖', '💖',  800,  800,  480, 'romantic', 'burst',
   '/animations/gifts/tiktok-jalwa/neon-heart-burst.svg',   'svg',
   '/animations/gifts/tiktok-jalwa/neon-heart-burst.svg',   9102, true, true, 'none'),
  ('Golden Swan',        '🦢', '🦢', 1000, 1000,  600, 'luxury',   'burst',
   '/animations/gifts/tiktok-jalwa/golden-swan.svg',        'svg',
   '/animations/gifts/tiktok-jalwa/golden-swan.svg',        9103, true, true, 'none'),
  ('Star Cascade',       '🌟', '🌟', 1200, 1200,  720, 'popular',  'burst',
   '/animations/gifts/tiktok-jalwa/star-cascade.svg',       'svg',
   '/animations/gifts/tiktok-jalwa/star-cascade.svg',       9104, true, true, 'none'),
  ('Royal Rose Garden',  '🌹', '🌹', 1500, 1500,  900, 'romantic', 'burst',
   '/animations/gifts/tiktok-jalwa/royal-rose-garden.svg',  'svg',
   '/animations/gifts/tiktok-jalwa/royal-rose-garden.svg',  9105, true, true, 'none'),
  ('Cosmic Butterfly',   '🦋', '🦋', 1800, 1800, 1080, 'luxury',   'burst',
   '/animations/gifts/tiktok-jalwa/cosmic-butterfly.svg',   'svg',
   '/animations/gifts/tiktok-jalwa/cosmic-butterfly.svg',   9106, true, true, 'none'),
  ('Fire Tiger',         '🐯', '🐯', 2200, 2200, 1320, 'luxury',   'burst',
   '/animations/gifts/tiktok-jalwa/fire-tiger.svg',         'svg',
   '/animations/gifts/tiktok-jalwa/fire-tiger.svg',         9107, true, true, 'none'),
  ('Jalwa Throne',       '👑', '👑', 3000, 3000, 1800, 'luxury',   'burst',
   '/animations/gifts/tiktok-jalwa/jalwa-throne.svg',       'svg',
   '/animations/gifts/tiktok-jalwa/jalwa-throne.svg',       9108, true, true, 'none')
ON CONFLICT DO NOTHING;

COMMIT;
