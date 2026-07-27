-- 10 romantic VIP video gifts (real cinematic MP4, 9:16 fullscreen).
BEGIN;

WITH v(name, price, url) AS (
  VALUES
    ('Rose Heart',       5000,  '/__l5e/assets-v1/f25d520a-0166-4e79-8bdd-04842a97605b/romantic-01-rose-heart.mp4'),
    ('Couple Dance',    15000,  '/__l5e/assets-v1/b9d966a7-755d-4170-b7b6-2d95d5fe8005/romantic-02-couple-dance.mp4'),
    ('Cupid Arrow',      8000,  '/__l5e/assets-v1/0971c015-5864-4d59-bb54-538455c50c72/romantic-03-cupid-arrow.mp4'),
    ('999 Roses',       20000,  '/__l5e/assets-v1/5f9eedde-833b-4f34-b68c-13944546c463/romantic-04-999-roses.mp4'),
    ('Diamond Ring',    30000,  '/__l5e/assets-v1/aa2d29a0-7607-4bc0-b4db-4ecc8efba9eb/romantic-05-diamond-ring.mp4'),
    ('Heart Fireworks', 10000,  '/__l5e/assets-v1/3ff6db76-aca6-4792-9138-ad6bcfc5383c/romantic-06-heart-fireworks.mp4'),
    ('Teddy Balloons',   6000,  '/__l5e/assets-v1/548729fc-3e0c-4e87-a13b-ce628b0e3085/romantic-07-teddy-balloons.mp4'),
    ('Love Letter',      7000,  '/__l5e/assets-v1/362cd661-9d4d-4a81-833b-800a5bad1e7d/romantic-08-love-letter.mp4'),
    ('Swan Lake',       25000,  '/__l5e/assets-v1/41af4246-a375-4db1-9c21-87e400f1945d/romantic-09-swan-lake.mp4'),
    ('Champagne Hearts',12000,  '/__l5e/assets-v1/c3db26a1-2168-4abc-960e-cb21518d4952/romantic-10-champagne-hearts.mp4')
)
INSERT INTO public.gifts
  (name, category, price, price_coins, diamonds_value, icon, image_url, icon_path, clip_path, clip_type, animation, is_active, active)
SELECT
  v.name, 'vip', v.price, v.price, v.price,
  v.url, v.url, v.url, v.url, 'mp4', 'fullscreen', true, true
FROM v
ON CONFLICT (name) DO UPDATE SET
  category = 'vip',
  price = EXCLUDED.price,
  price_coins = EXCLUDED.price_coins,
  diamonds_value = EXCLUDED.diamonds_value,
  icon = EXCLUDED.icon,
  image_url = EXCLUDED.image_url,
  icon_path = EXCLUDED.icon_path,
  clip_path = EXCLUDED.clip_path,
  clip_type = 'mp4',
  animation = 'fullscreen',
  is_active = true,
  active = true;

COMMIT;
