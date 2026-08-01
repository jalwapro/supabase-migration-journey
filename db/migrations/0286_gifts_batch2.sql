-- Batch 2 of the premium gift expansion: 15 new AAA gifts.
-- Icons live in Cloudflare R2 (gifts/batch2/*), the only storage provider.
-- Video clips are attached in a follow-up migration once rendered.

insert into public.gifts
  (name, emoji, icon, category, price, price_coins, diamonds_value,
   image_url, thumb_url, icon_path, clip_type, chromakey, animation,
   sort_order, priority, is_active, active, batch_name, batch_created_at)
select
  v.name, v.emoji, v.emoji, v.category, v.price, v.price, v.price,
  u.url, u.url, u.url, 'mp4', 'green', 'pop',
  320 + v.ord, v.priority, true, true, 'batch2_premium', now()
from (values
  ('Celestial Phoenix',   '🔥', 'mythic',    17999, 17, 1),
  ('Diamond Yacht',       '🛥️', 'luxury',    14999, 16, 2),
  ('Royal Peacock',       '🦚', 'animals',   5200,  10, 3),
  ('Crystal Piano',       '🎹', 'premium',   4800,  9,  4),
  ('Ruby Dragon',         '🐉', 'legendary', 16999, 17, 5),
  ('Neon Hypercar',       '🏎️', 'vehicles',  11999, 15, 6),
  ('Frozen Throne',       '🧊', 'fantasy',   9200,  13, 7),
  ('Galaxy Locket',       '💖', 'romantic',  3600,  8,  8),
  ('Gilded Balloon',      '🎈', 'party',     2400,  7,  9),
  ('Rune Tiger',          '🐯', 'fantasy',   8600,  12, 10),
  ('Champagne Tower',     '🍾', 'party',     3200,  8,  11),
  ('Sakura Spirit',       '🌸', 'flowers',   4100,  9,  12),
  ('Meteor Rider',        '☄️', 'cosmic',    7400,  11, 13),
  ('Obsidian Panther',    '🐆', 'legendary', 13500, 15, 14),
  ('Jade Imperial Fan',   '🪭', 'vip',       18999, 18, 15)
) as v(name, emoji, category, price, priority, ord)
cross join lateral (
  select 'https://pub-788f85351d2748f4911a8c6d85d011af.r2.dev/gifts/batch2/'
    || replace(lower(v.name), ' ', '-') || '.png' as url
) u
where not exists (select 1 from public.gifts g where g.name = v.name);
