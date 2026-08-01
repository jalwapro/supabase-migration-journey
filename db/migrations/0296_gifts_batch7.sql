-- Batch 7 (final) of the premium gift expansion: 15 new AAA gifts.
-- Icons live in Cloudflare R2 (gifts/batch7/*), the only storage provider.

insert into public.gifts
  (name, emoji, icon, category, price, price_coins, diamonds_value,
   image_url, thumb_url, icon_path, clip_type, chromakey, animation,
   sort_order, priority, is_active, active, batch_name, batch_created_at)
select
  v.name, v.emoji, v.emoji, v.category, v.price, v.price, v.price,
  u.url, u.url, u.url, 'mp4', 'green', 'pop',
  420 + v.ord, v.priority, true, true, 'batch7_premium', now()
from (values
  ('Diamond Swan',      '🦢', 'luxury',    7400,  12, 1),
  ('Sky Castle',        '🏰', 'vip',       21600, 18, 2),
  ('Clockwork Owl',     '🦉', 'fantasy',   6800,  11, 3),
  ('Magma Phoenix',     '🔥', 'mythic',    18400, 17, 4),
  ('Platinum Supercar', '🏎️', 'luxury',    16200, 16, 5),
  ('Royal Perfume',     '🧴', 'romantic',  3900,  8,  6),
  ('Star Compass',      '🧭', 'premium',   4800,  9,  7),
  ('Golden Pegasus',    '🐴', 'legendary', 15600, 16, 8),
  ('Cyber Katana',      '🗡️', 'fantasy',   9400,  13, 9),
  ('Treasure Vault',    '💰', 'vip',       19200, 17, 10),
  ('Crystal Koi',       '🐟', 'premium',   5600,  10, 11),
  ('Opera Masks',       '🎭', 'party',     3200,  7,  12),
  ('Aurora Jellyfish',  '🪼', 'cosmic',    10600, 14, 13),
  ('Dove Clock',        '🕊️', 'romantic',  6400,  11, 14),
  ('Orbit Station',     '🛰️', 'cosmic',    12800, 15, 15)
) as v(name, emoji, category, price, priority, ord)
cross join lateral (
  select 'https://pub-788f85351d2748f4911a8c6d85d011af.r2.dev/gifts/batch7/'
    || replace(lower(v.name), ' ', '-') || '.png' as url
) u
where not exists (select 1 from public.gifts g where g.name = v.name);
