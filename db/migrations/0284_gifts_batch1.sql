-- Batch 1 of the premium gift expansion: 15 new AAA gifts.
-- Icons live in Cloudflare R2 (gifts/batch1/*), the only storage provider.
-- Video clips are attached in a follow-up statement once rendered.

insert into public.gifts
  (name, emoji, icon, category, price, price_coins, diamonds_value,
   image_url, thumb_url, icon_path, clip_type, chromakey, animation,
   sort_order, priority, is_active, active, batch_name, batch_created_at)
select
  v.name, v.emoji, v.emoji, v.category, v.price, v.price, v.price,
  v.url, v.url, v.url, 'mp4', 'green', 'pop',
  300 + v.ord, v.priority, true, true, 'batch1_premium', now()
from (values
  ('Aurora Whale',          '🐋', 'cosmic',    9999,  14, 1),
  ('Obsidian Phantom Bike', '🏍️', 'vehicles',  6666,  11, 2),
  ('Solar Lotus',           '🪷', 'flowers',   3999,  8,  3),
  ('Emerald Serpent',       '🐍', 'mythic',    12999, 15, 4),
  ('Starlight Carousel',    '🎠', 'fantasy',   8888,  13, 5),
  ('Platinum Falcon',       '🦅', 'luxury',    7777,  12, 6),
  ('Nebula Violin',         '🎻', 'premium',   5555,  10, 7),
  ('Frost Kitsune',         '🦊', 'fantasy',   9500,  13, 8),
  ('Molten Titan Fist',     '👊', 'legendary', 15999, 16, 9),
  ('Velvet Rose Vault',     '🌹', 'romantic',  4444,  9,  10),
  ('Sapphire Hourglass',    '⏳', 'premium',   3333,  8,  11),
  ('Thunder Stallion',      '🐎', 'animals',   6800,  11, 12),
  ('Honey Macaron Tower',   '🍬', 'sweets',    1999,  6,  13),
  ('Crown of Eclipse',      '👑', 'vip',       19999, 18, 14),
  ('Lantern Sky Festival',  '🏮', 'party',     2999,  7,  15)
) as v(name, emoji, category, price, priority, ord)
cross join lateral (
  select 'https://pub-788f85351d2748f4911a8c6d85d011af.r2.dev/gifts/batch1/'
    || replace(lower(v.name), ' ', '-') || '.png' as url
) u
where not exists (select 1 from public.gifts g where g.name = v.name);
