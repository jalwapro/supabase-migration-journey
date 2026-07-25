-- 0174 Real animated SVGA gifts — plays motion animation, TikTok-style.
-- Files live in public/animations/gifts/svga/*.svga (12 free SVGA samples).

insert into public.gifts
  (name,           emoji, icon,  price,  price_coins, diamonds_value, category,  animation, sort_order, clip_path,                                     clip_type, is_active, active)
values
  ('Red Rose',      '🌹', '🌹',    10,     10,      5,  'popular',  'pop',   1, '/animations/gifts/svga/rose.svga',        'svga', true, true),
  ('Heart Burst',   '💖', '💖',    20,     20,     10,  'popular',  'pop',   2, '/animations/gifts/svga/TwitterHeart.svga','svga', true, true),
  ('Heart',         '❤️', '❤️',    30,     30,     15,  'popular',  'pop',   3, '/animations/gifts/svga/heart.svga',       'svga', true, true),
  ('Heartbeat',     '💓', '💓',    50,     50,     25,  'popular',  'pop',   4, '/animations/gifts/svga/heartbeat.svga',   'svga', true, true),
  ('Gift Box',      '🎁', '🎁',   100,    100,     50,  'popular',  'pop',   5, '/animations/gifts/svga/giftbox.svga',     'svga', true, true),
  ('Rocket',        '🚀', '🚀',   200,    200,    100,  'popular',  'pop',   6, '/animations/gifts/svga/Rocket.svga',      'svga', true, true),
  ('Angel Wings',   '👼', '👼',   500,    500,    250,  'luxury',   'pop',   7, '/animations/gifts/svga/angel.svga',       'svga', true, true),
  ('Halloween',     '🎃', '🎃',   500,    500,    250,  'luxury',   'pop',   8, '/animations/gifts/svga/halloween.svga',   'svga', true, true),
  ('King Set',      '👑', '👑',  1000,   1000,    500,  'luxury',   'pop',   9, '/animations/gifts/svga/kingset.svga',     'svga', true, true),
  ('Golden Crown',  '👑', '👑',  1500,   1500,    750,  'luxury',   'pop',  10, '/animations/gifts/svga/crown.svga',       'svga', true, true),
  ('Porsche',       '🏎️', '🏎️',  2000,   2000,   1000,  'luxury',   'pop',  11, '/animations/gifts/svga/posche.svga',      'svga', true, true),
  ('Ferrari',       '🏎️', '🏎️',  3000,   3000,   1500,  'luxury',   'pop',  12, '/animations/gifts/svga/ferrari.svga',     'svga', true, true)
on conflict (name) do update
  set clip_path  = excluded.clip_path,
      clip_type  = excluded.clip_type,
      icon_path  = null,
      image_url  = null,
      price      = excluded.price,
      price_coins= excluded.price_coins,
      diamonds_value = excluded.diamonds_value,
      category   = excluded.category,
      sort_order = excluded.sort_order,
      is_active  = true,
      active     = true;

-- Deactivate the static PNG-only starter25/luxury25 gifts so only the
-- animated SVGA gifts appear in the sheet.
update public.gifts
   set is_active = false, active = false
 where (icon_path like '/animations/gifts/starter25/%'
     or icon_path like '/animations/gifts/luxury25/%'
     or image_url like '/animations/gifts/starter25/%'
     or image_url like '/animations/gifts/luxury25/%')
   and clip_type is distinct from 'svga';
