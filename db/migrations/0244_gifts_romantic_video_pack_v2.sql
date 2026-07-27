-- 10 more romantic VIP video gifts (v2 pack) — cinematic 10s MP4, 9:16 fullscreen.
BEGIN;

WITH v(name, price, url) AS (
  VALUES
    ('Rooftop Kiss',       8000,  '/__l5e/assets-v1/a1b29c69-f9fe-4ea6-b777-3939c7019baa/01-rooftop-kiss.mp4'),
    ('Crystal Heart Burst',15000, '/__l5e/assets-v1/7df8cf11-a5f8-48d3-8538-917c8e02ce69/02-crystal-heart-burst.mp4'),
    ('Ballroom Waltz',     20000, '/__l5e/assets-v1/fb2e63e9-4c97-4741-ac49-e250b506f0a8/03-ballroom-waltz.mp4'),
    ('Proposal Fireworks', 40000, '/__l5e/assets-v1/283b9a4d-e6c7-4bd9-974b-ba853244aea7/04-proposal-fireworks.mp4'),
    ('Golden Carriage',    35000, '/__l5e/assets-v1/20a9db23-6afe-482b-876d-be5c335167ae/05-golden-carriage.mp4'),
    ('Sunset Beach Love',  10000, '/__l5e/assets-v1/eebb7726-9e5b-4cb1-82a6-36b490f44633/06-sunset-beach.mp4'),
    ('999 Roses Heart',    50000, '/__l5e/assets-v1/52b0368c-56af-406e-ba16-264038c96b28/07-999-roses-heart.mp4'),
    ('Pegasus of Love',    45000, '/__l5e/assets-v1/3526a763-6b70-4a02-af44-bef62262c8b0/08-pegasus-flight.mp4'),
    ('Swan Heart Lake',    25000, '/__l5e/assets-v1/36fd7450-3ea2-47dc-b020-f29e5d2325b1/09-swan-heart-lake.mp4'),
    ('Teddy & Chocolate',   6000, '/__l5e/assets-v1/b3f5a491-9214-4104-a226-70d5675623b1/10-teddy-chocolate.mp4')
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
