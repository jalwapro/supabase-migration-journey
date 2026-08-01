-- Batch 5 of the premium gift expansion: 16 new AAA gifts.
-- Icons live in Cloudflare R2 (gifts/batch5/*), the only storage provider.
-- Video clips are attached in a follow-up migration once rendered.

insert into public.gifts
  (name, emoji, icon, category, price, price_coins, diamonds_value,
   image_url, thumb_url, icon_path, clip_type, chromakey, animation,
   sort_order, priority, is_active, active, batch_name, batch_created_at)
select
  v.name, v.emoji, v.emoji, v.category, v.price, v.price, v.price,
  u.url, u.url, u.url, 'mp4', 'green', 'pop',
  380 + v.ord, v.priority, true, true, 'batch5_premium', now()
from (values
  ('Golden Peacock',    '🦚', 'mythic',    16400, 16, 1),
  ('Crystal Unicorn',   '🦄', 'fantasy',   12600, 15, 2),
  ('Diamond Helicopter','🚁', 'luxury',    15800, 16, 3),
  ('Galaxy Whale',      '🐋', 'cosmic',    13900, 15, 4),
  ('Lion Chariot',      '🦁', 'legendary', 14700, 15, 5),
  ('Rose Music Box',    '🎵', 'romantic',  3600,  8,  6),
  ('Thunder Eagle',     '🦅', 'animals',   9200,  13, 7),
  ('Emerald Palace',    '🕌', 'vip',       19800, 18, 8),
  ('Sapphire Dolphin',  '🐬', 'premium',   5100,  10, 9),
  ('Time Hourglass',    '⏳', 'premium',   4300,  9,  10),
  ('Fire Tiger',        '🐯', 'legendary', 10400, 14, 11),
  ('Pearl Carriage',    '🛞', 'romantic',  6900,  11, 12),
  ('Neon Samurai Mask', '👺', 'fantasy',   7800,  12, 13),
  ('Golden Champagne',  '🍾', 'party',     2800,  7,  14),
  ('Angel Locket',      '💛', 'romantic',  3100,  7,  15),
  ('Cosmic Dragon Egg', '🥚', 'cosmic',    11200, 14, 16)
) as v(name, emoji, category, price, priority, ord)
cross join lateral (
  select 'https://pub-788f85351d2748f4911a8c6d85d011af.r2.dev/gifts/batch5/'
    || replace(lower(v.name), ' ', '-') || '.png' as url
) u
where not exists (select 1 from public.gifts g where g.name = v.name);
