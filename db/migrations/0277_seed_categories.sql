-- Seed room discovery categories (table was empty, so create-room / PK pages
-- fell back to fake non-UUID ids that could never satisfy the FK) and backfill
-- gift categories that gifts already reference but were missing from the
-- gift_categories list used by the admin panel and gift sheet.

INSERT INTO public.categories (name, slug, icon, sort_order, active) VALUES
  ('Popular',      'popular',      '🔥', 0,  true),
  ('Music',        'music',        '🎵', 1,  true),
  ('Chat',         'chat',         '💬', 2,  true),
  ('Party',        'party',        '🎉', 3,  true),
  ('Gaming',       'gaming',       '🎮', 4,  true),
  ('Dance',        'dance',        '💃', 5,  true),
  ('PK Battle',    'pk',           '🥊', 6,  true),
  ('Entertainment','entertainment','🎬', 7,  true),
  ('Friends',      'friends',      '🤝', 8,  true),
  ('Talent',       'talent',       '⭐', 9,  true),
  ('Podcast',      'podcast',      '🎙️', 10, true),
  ('New',          'new',          '🆕', 11, true)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      icon = EXCLUDED.icon,
      sort_order = EXCLUDED.sort_order,
      active = true;

INSERT INTO public.gift_categories (slug, name, icon, sort_order, is_active) VALUES
  ('vip',       'VIP',       '👑', 10, true),
  ('romantic',  'Romantic',  '💖', 11, true),
  ('magic',     'Magic',     '🪄', 12, true),
  ('fantasy',   'Fantasy',   '🧚', 13, true),
  ('legendary', 'Legendary', '🏆', 14, true),
  ('mythic',    'Mythic',    '🐉', 15, true)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      icon = EXCLUDED.icon,
      is_active = true;
