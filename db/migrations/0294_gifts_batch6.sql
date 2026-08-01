-- Batch 6 of the premium gift expansion: 15 new AAA gifts.
-- Icons live in Cloudflare R2 (gifts/batch6/*), the only storage provider.
-- Video clips are attached in a follow-up migration once rendered.

insert into public.gifts
  (name, emoji, icon, category, price, price_coins, diamonds_value,
   image_url, thumb_url, icon_path, clip_type, chromakey, animation,
   sort_order, priority, is_active, active, batch_name, batch_created_at)
select
  v.name, v.emoji, v.emoji, v.category, v.price, v.price, v.price,
  u.url, u.url, u.url, 'mp4', 'green', 'pop',
  400 + v.ord, v.priority, true, true, 'batch6_premium', now()
from (values
  ('Phoenix Quill',       '🪶', 'mythic',    9800,  13, 1),
  ('Sapphire Throne',     '💺', 'vip',       20400, 18, 2),
  ('Celestial Wolf',      '🐺', 'cosmic',    13400, 15, 3),
  ('Imperial Yacht',      '🛥️', 'luxury',    17200, 17, 4),
  ('Eternal Watch',       '⌚', 'premium',   4600,  9,  5),
  ('Frost Crown',         '👑', 'legendary', 11800, 14, 6),
  ('Emerald Griffin',     '🦅', 'mythic',    15200, 16, 7),
  ('Neon Hoverbike',      '🏍️', 'luxury',    8600,  12, 8),
  ('Ruby Heart',          '❤️', 'romantic',  3400,  8,  9),
  ('Cosmic Lion',         '🦁', 'legendary', 14200, 15, 10),
  ('Crystal Hummingbird', '🐦', 'fantasy',   6200,  11, 11),
  ('Obsidian Pyramid',    '🔺', 'cosmic',    12400, 14, 12),
  ('Firework Cannon',     '🎆', 'party',     2600,  7,  13),
  ('Jade Dragon',         '🐉', 'mythic',    16800, 17, 14),
  ('Platinum Wings',      '🕊️', 'premium',   5400,  10, 15)
) as v(name, emoji, category, price, priority, ord)
cross join lateral (
  select 'https://pub-788f85351d2748f4911a8c6d85d011af.r2.dev/gifts/batch6/'
    || replace(lower(v.name), ' ', '-') || '.png' as url
) u
where not exists (select 1 from public.gifts g where g.name = v.name);
