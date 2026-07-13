-- 0116 Jalwa Luxury Collection 051-075 (cinematic AI-generated MP4 clips)
-- Ultra-premium 9:16 vertical luxury gift animations. Uses ON CONFLICT so re-runs are safe.

BEGIN;

-- Ensure name is unique so ON CONFLICT works. Safe to re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gifts_name_key'
  ) THEN
    ALTER TABLE public.gifts ADD CONSTRAINT gifts_name_key UNIQUE (name);
  END IF;
END $$;

INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation, sort_order, is_active, active, clip_path, clip_type, image_url)
VALUES
  ('Diamond Watch',          '⌚', '⌚', 199,   199,   100,   'luxury', 'shine',  501, true, true, '/__l5e/assets-v1/1c99c802-f161-498e-9881-0268e852a053/jalwa-diamond-watch.mp4',          'mp4', NULL),
  ('Luxury Perfume',         '🌸', '🌸', 299,   299,   150,   'luxury', 'shine',  502, true, true, '/__l5e/assets-v1/e9ed36be-cfcc-435d-84cd-7972627eb21e/jalwa-luxury-perfume.mp4',         'mp4', NULL),
  ('Gold Bar',               '🧱', '🧱', 399,   399,   200,   'luxury', 'shine',  503, true, true, '/__l5e/assets-v1/00dfe452-aea9-44d7-9815-48b85459e381/jalwa-gold-bar.mp4',               'mp4', NULL),
  ('Diamond Necklace',       '💎', '💎', 499,   499,   250,   'luxury', 'sparkle',504, true, true, '/__l5e/assets-v1/e359cd69-2619-4319-b4f9-a40bdccf7f5e/jalwa-diamond-necklace.mp4',       'mp4', NULL),
  ('Premium Handbag',        '👜', '👜', 699,   699,   350,   'luxury', 'shine',  505, true, true, '/__l5e/assets-v1/5a4752e5-0adb-4381-8201-3481dc1b1c22/jalwa-premium-handbag.mp4',        'mp4', NULL),
  ('Royal Crown',            '👑', '👑', 899,   899,   450,   'luxury', 'shine',  506, true, true, '/__l5e/assets-v1/b27dcc59-4d52-48b8-ab6a-d0f2a2bd9583/jalwa-royal-crown.mp4',            'mp4', NULL),
  ('Luxury Sports Car',      '🏎️','🏎️',1299,  1299,  650,   'luxury', 'zoom',   507, true, true, '/__l5e/assets-v1/6232f31a-d029-4646-8eb0-61a36a819b55/jalwa-luxury-sports-car.mp4',      'mp4', NULL),
  ('Lamborghini',            '🏎️','🏎️',1599,  1599,  800,   'luxury', 'zoom',   508, true, true, '/__l5e/assets-v1/c7df8a05-f198-41a4-8d2b-997ca27df0ee/jalwa-lamborghini.mp4',            'mp4', NULL),
  ('Ferrari',                '🏎️','🏎️',1999,  1999,  1000,  'luxury', 'zoom',   509, true, true, '/__l5e/assets-v1/bee37889-94af-47d0-b086-85702b3ad76d/jalwa-ferrari.mp4',                'mp4', NULL),
  ('Rolls-Royce Phantom',    '🚗', '🚗', 2499,  2499,  1250,  'luxury', 'slide',  510, true, true, '/__l5e/assets-v1/6cc662b9-1376-4cc1-8882-18f34fafe283/jalwa-rolls-royce-phantom.mp4',    'mp4', NULL),
  ('Private Helicopter',     '🚁', '🚁', 2999,  2999,  1500,  'luxury', 'launch', 511, true, true, '/__l5e/assets-v1/556f4370-8f41-432b-a125-48fce3c70578/jalwa-private-helicopter.mp4',     'mp4', NULL),
  ('Private Jet',            '🛩️','🛩️',3999,  3999,  2000,  'luxury', 'launch', 512, true, true, '/__l5e/assets-v1/5a3b8396-c5d6-4fbf-ad7f-0cdcd4c657ad/jalwa-private-jet.mp4',            'mp4', NULL),
  ('Super Yacht',            '🛥️','🛥️',4999,  4999,  2500,  'luxury', 'slide',  513, true, true, '/__l5e/assets-v1/e41da3f8-5c66-4c18-a455-68d81861941c/jalwa-super-yacht.mp4',            'mp4', NULL),
  ('Luxury Villa',           '🏝️','🏝️',5999,  5999,  3000,  'luxury', 'shine',  514, true, true, '/__l5e/assets-v1/f5105812-4e8e-4968-85ba-b1381ea6c015/jalwa-luxury-villa.mp4',           'mp4', NULL),
  ('Diamond Safe',           '🔐', '🔐', 6999,  6999,  3500,  'luxury', 'burst',  515, true, true, '/__l5e/assets-v1/b80c7b36-c572-4e1c-830c-597133b0c244/jalwa-diamond-safe.mp4',           'mp4', NULL),
  ('Treasure Chest',         '💰', '💰', 7999,  7999,  4000,  'luxury', 'burst',  516, true, true, '/__l5e/assets-v1/1e892ec5-062c-48f6-a6a6-f61604d7a578/jalwa-treasure-chest.mp4',         'mp4', NULL),
  ('Golden Peacock',         '🦚', '🦚', 8999,  8999,  4500,  'luxury', 'shine',  517, true, true, '/__l5e/assets-v1/96446176-1e22-4239-9f77-8b757b84e18a/jalwa-golden-peacock.mp4',         'mp4', NULL),
  ('White Stallion',         '🐎', '🐎', 9999,  9999,  5000,  'luxury', 'zoom',   518, true, true, '/__l5e/assets-v1/04816a42-c558-409e-9758-1036e6ed5066/jalwa-white-stallion.mp4',         'mp4', NULL),
  ('Crystal Piano',          '🎹', '🎹', 12999, 12999, 6500,  'vip',    'shine',  519, true, true, '/__l5e/assets-v1/5ff94bc1-6d31-40c5-aae7-b2740a1982a2/jalwa-crystal-piano.mp4',          'mp4', NULL),
  ('Royal Ballroom',         '🏛️','🏛️',15999, 15999, 8000,  'vip',    'shine',  520, true, true, '/__l5e/assets-v1/2e6c8b06-357e-41f8-88c2-a8e39c4e93e5/jalwa-royal-ballroom.mp4',         'mp4', NULL),
  ('Diamond Fountain',       '⛲', '⛲', 18999, 18999, 9500,  'vip',    'burst',  521, true, true, '/__l5e/assets-v1/048feb65-d315-41b8-96d8-e857f4af050b/jalwa-diamond-fountain.mp4',       'mp4', NULL),
  ('Golden Palace',          '🏰', '🏰', 24999, 24999, 12500, 'vip',    'shine',  522, true, true, '/__l5e/assets-v1/d6380413-21fe-48d5-b4c6-7fce47051937/jalwa-golden-palace.mp4',          'mp4', NULL),
  ('Floating Luxury Island', '🏝️','🏝️',39999, 39999, 20000, 'mythic', 'launch', 523, true, true, '/__l5e/assets-v1/c3edd4db-94f8-46b8-90d3-622ade89427a/jalwa-floating-luxury-island.mp4', 'mp4', NULL),
  ('Millionaire Mansion',    '🏛️','🏛️',59999, 59999, 30000, 'mythic', 'shine',  524, true, true, '/__l5e/assets-v1/5eeb7145-b3bc-4f5d-9b42-6fffec6657f9/jalwa-millionaire-mansion.mp4',    'mp4', NULL),
  ('Billionaire Empire',     '🌆', '🌆', 99999, 99999, 50000, 'mythic', 'launch', 525, true, true, '/__l5e/assets-v1/39e0fcd9-bef3-4ce1-a0b5-c758f3af125b/jalwa-billionaire-empire.mp4',     'mp4', NULL)
ON CONFLICT (name) DO UPDATE SET
  emoji          = EXCLUDED.emoji,
  icon           = EXCLUDED.icon,
  price          = EXCLUDED.price,
  price_coins    = EXCLUDED.price_coins,
  diamonds_value = EXCLUDED.diamonds_value,
  category       = EXCLUDED.category,
  animation      = EXCLUDED.animation,
  sort_order     = EXCLUDED.sort_order,
  is_active      = true,
  active         = true,
  clip_path      = EXCLUDED.clip_path,
  clip_type      = 'mp4';

COMMIT;
