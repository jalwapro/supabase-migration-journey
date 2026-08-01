-- Batch 3 of the premium gift expansion: 15 new AAA gifts.
-- Icons live in Cloudflare R2 (gifts/batch3/*), the only storage provider.
-- Video clips are attached in a follow-up migration once rendered.

insert into public.gifts
  (name, emoji, icon, category, price, price_coins, diamonds_value,
   image_url, thumb_url, icon_path, clip_type, chromakey, animation,
   sort_order, priority, is_active, active, batch_name, batch_created_at)
select
  v.name, v.emoji, v.emoji, v.category, v.price, v.price, v.price,
  u.url, u.url, u.url, 'mp4', 'green', 'pop',
  340 + v.ord, v.priority, true, true, 'batch3_premium', now()
from (values
  ('Golden Griffin',       '🦁', 'mythic',    15500, 16, 1),
  ('Platinum Jet',         '✈️', 'luxury',    13800, 15, 2),
  ('Seraph Wings',         '🕊️', 'fantasy',   10500, 14, 3),
  ('Treasure Vault',       '💰', 'luxury',    6900,  11, 4),
  ('Prism Unicorn',        '🦄', 'fantasy',   7800,  12, 5),
  ('Eternal Watch',        '⌚', 'premium',   4600,  9,  6),
  ('Pink Diamond Ring',    '💍', 'romantic',  12500, 15, 7),
  ('Golden Koi',           '🐟', 'animals',   2800,  7,  8),
  ('Cosmic Owl',           '🦉', 'cosmic',    6200,  11, 9),
  ('Rose Elixir',          '🌷', 'romantic',  3400,  8,  10),
  ('Thunder Hammer',       '🔨', 'legendary', 14200, 16, 11),
  ('Royal Cake',           '🎂', 'party',     2600,  7,  12),
  ('Clockwork Butterfly',  '🦋', 'premium',   5100,  10, 13),
  ('Sky Castle',           '🏰', 'legendary', 18500, 17, 14),
  ('Void Scepter',         '🔮', 'vip',       19500, 18, 15)
) as v(name, emoji, category, price, priority, ord)
cross join lateral (
  select 'https://pub-788f85351d2748f4911a8c6d85d011af.r2.dev/gifts/batch3/'
    || replace(lower(v.name), ' ', '-') || '.png' as url
) u
where not exists (select 1 from public.gifts g where g.name = v.name);
