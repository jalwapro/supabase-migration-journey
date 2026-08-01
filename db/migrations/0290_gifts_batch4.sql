-- Batch 4 of the premium gift expansion: 15 new AAA gifts.
-- Icons live in Cloudflare R2 (gifts/batch4/*), the only storage provider.
-- Video clips are attached in a follow-up migration once rendered.

insert into public.gifts
  (name, emoji, icon, category, price, price_coins, diamonds_value,
   image_url, thumb_url, icon_path, clip_type, chromakey, animation,
   sort_order, priority, is_active, active, batch_name, batch_created_at)
select
  v.name, v.emoji, v.emoji, v.category, v.price, v.price, v.price,
  u.url, u.url, u.url, 'mp4', 'green', 'pop',
  360 + v.ord, v.priority, true, true, 'batch4_premium', now()
from (values
  ('Dragon Crown',        '🐉', 'mythic',    17800, 17, 1),
  ('Ocean Emperor',       '🛥️', 'luxury',    16200, 16, 2),
  ('Frost Phoenix',       '🧊', 'fantasy',   11800, 14, 3),
  ('Emperor Throne',      '👑', 'vip',       20500, 18, 4),
  ('Neon Hypercar',       '🏎️', 'luxury',    14800, 16, 5),
  ('Crystal Lotus',       '🪷', 'romantic',  3900,  8,  6),
  ('Sky Lantern Balloon', '🎈', 'party',     3200,  7,  7),
  ('Star Wolf',           '🐺', 'cosmic',    9400,  13, 8),
  ('Melody Gramophone',   '🎼', 'premium',   4400,  9,  9),
  ('Ruby Heart',          '❤️', 'romantic',  2900,  7,  10),
  ('Genie Lamp',          '🪔', 'fantasy',   7600,  12, 11),
  ('Diamond Tiara',       '💎', 'premium',   8800,  12, 12),
  ('Lion Medallion',      '🦁', 'animals',   5300,  10, 13),
  ('Arcane Tome',         '📖', 'legendary', 6700,  11, 14),
  ('Gold Rocket',         '🚀', 'cosmic',    12900, 15, 15)
) as v(name, emoji, category, price, priority, ord)
cross join lateral (
  select 'https://pub-788f85351d2748f4911a8c6d85d011af.r2.dev/gifts/batch4/'
    || replace(lower(v.name), ' ', '-') || '.png' as url
) u
where not exists (select 1 from public.gifts g where g.name = v.name);
