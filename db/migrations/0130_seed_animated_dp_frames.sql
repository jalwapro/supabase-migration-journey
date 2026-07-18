-- ============================================================================
-- Seed animated DP frames into the Shop (Frame category).
-- Includes: 3 Live WebM (transparent), 11 Premium PNG (ornate), 5 SVG.
-- Dual-currency: price (coins) + price_diamonds. Duration 30 days.
-- Idempotent by name.
-- ============================================================================

DO $$
DECLARE
  _cat uuid;
BEGIN
  SELECT id INTO _cat FROM public.theme_categories WHERE slug = 'frame' LIMIT 1;
  IF _cat IS NULL THEN
    RAISE EXCEPTION 'frame category missing';
  END IF;

  -- (name, animation_url, preview_url, price_coins, price_diamonds, duration_days, is_premium, sort)
  INSERT INTO public.themes
    (name, description, category_id, animation_url, preview_url,
     price, price_diamonds, duration_days, is_premium, is_active, sort, is_free)
  SELECT v.name, v.descr, _cat, v.url, v.url,
         v.coins, v.diamonds, 30, v.premium, true, v.sort, false
  FROM (VALUES
    -- 🎬 Live animated (transparent WebM) — top premium
    ('Boss Emerald Live',   'Live animated ornate emerald frame',    '/animations/frames/webm/boss-emerald.webm',   50000, 5000, true, 1),
    ('Lion Ruby Live',      'Live animated ruby lion crest',         '/animations/frames/webm/lion-ruby.webm',      50000, 5000, true, 2),
    ('Sapphire Crown Live', 'Live animated sapphire winged crown',   '/animations/frames/webm/sapphire-crown.webm', 60000, 6000, true, 3),

    -- ✨ Behance-style ornate PNG frames
    ('Golden Fire Ring', 'Rotating golden fire ring',       '/animations/frames/golden-fire-ring.png', 30000, 3000, true,  10),
    ('Dragon Coil',      'Golden dragon coiled avatar',     '/animations/frames/dragon-coil.png',      35000, 3500, true,  11),
    ('Thunder Phoenix',  'Blue lightning phoenix wings',    '/animations/frames/thunder-phoenix.png',  28000, 2800, true,  12),
    ('Sakura Petals',    'Pink cherry blossom petal ring',  '/animations/frames/sakura-petals.png',    18000, 1800, false, 13),
    ('Emperor Crown',    'Jade & gold imperial crown',      '/animations/frames/emperor-crown.png',    32000, 3200, true,  14),
    ('Boss Emerald',     'Emerald wings + BOSS plaque',     '/animations/frames/boss-emerald.png',     25000, 2500, true,  15),
    ('Royal Elephant',   'Ivory scrollwork + ruby gems',    '/animations/frames/royal-elephant.png',   22000, 2200, true,  16),
    ('Lion Ruby',        'Square gold lion crest',          '/animations/frames/lion-ruby.png',        25000, 2500, true,  17),
    ('Sapphire Crown',   'Blue sapphire star + wings',      '/animations/frames/sapphire-crown.png',   28000, 2800, true,  18),
    ('Oasis Palace',     'Arabian palms + blue diamonds',   '/animations/frames/oasis-palace.png',     20000, 2000, false, 19),
    ('Celestial Star',   'Indigo enamel + sapphire stars',  '/animations/frames/celestial-star.png',   26000, 2600, true,  20),

    -- 🎨 SVG animated frames (lower tier)
    ('Royal Gold Crown', 'Rotating gold crown with sparkles',  '/animations/frames/royal-gold.svg',      10000, 1000, false, 30),
    ('Neon Cyber',       'Cyan/purple neon scan brackets',     '/animations/frames/neon-cyber.svg',       8000,  800, false, 31),
    ('Fire Phoenix',     'Pulsing fire core with flame tongues','/animations/frames/fire-phoenix.svg',   12000, 1200, false, 32),
    ('Diamond Ice',      'Shimmering ice with rotating gems',  '/animations/frames/diamond-ice.svg',     10000, 1000, false, 33),
    ('Butterfly Dream',  'Floating butterflies + hearts',      '/animations/frames/butterfly-dream.svg',  8000,  800, false, 34)
  ) AS v(name, descr, url, coins, diamonds, premium, sort)
  WHERE NOT EXISTS (SELECT 1 FROM public.themes t WHERE t.name = v.name);
END $$;
