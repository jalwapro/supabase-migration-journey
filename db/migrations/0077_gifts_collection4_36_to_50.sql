-- Collection 4: 15 more premium animated gifts (36-50) — no sound
INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation, clip_path, clip_type, image_url, sort_order, is_active, active)
VALUES
  ('Rainbow Balloon',   '🎈',  '🎈',  399,  399,  399,  'popular',   'float',   '/animations/gifts/hot-balloon.svg',       'svg', '/__l5e/assets-v1/7dd13ca3-0b66-433d-8ce5-9e391a04e4a3/36_hot_balloon.png',    36, true, true),
  ('Lion King',         '🦁',  '🦁', 5999, 5999, 5999, 'legendary', 'shine',   '/animations/gifts/lion-king.svg',         'svg', '/__l5e/assets-v1/c231a4d8-0fe9-4260-8742-19320642355c/37_lion_king.png',      37, true, true),
  ('Sakura Branch',     '🌸',  '🌸',  299,  299,  299,  'love',      'float',   '/animations/gifts/sakura-bloom.svg',      'svg', '/__l5e/assets-v1/a54c6809-1fca-4391-b4c2-a59bc968c1bb/38_sakura.png',         38, true, true),
  ('Diamond Necklace',  '💎',  '💎', 3499, 3499, 3499, 'luxury',    'sparkle', '/animations/gifts/diamond-necklace.svg',  'svg', '/__l5e/assets-v1/bde071cc-888b-4721-9dfc-38544b0b93dd/39_necklace.png',       39, true, true),
  ('Puppy Love',        '🐶',  '🐶',  199,  199,  199,  'love',      'pulse',   '/animations/gifts/puppy-love.svg',        'svg', '/__l5e/assets-v1/bae131bf-8a14-440b-8df9-6d0849bbfc9b/40_puppy.png',          40, true, true),
  ('Magic Butterfly',   '🦋',  '🦋',  899,  899,  899,  'magic',     'float',   '/animations/gifts/magic-butterfly.svg',   'svg', '/__l5e/assets-v1/b0f138d1-e4ac-4f26-86e9-fa7ab4d47073/41_butterfly.png',      41, true, true),
  ('Pink Mermaid',      '🧜',  '🧜', 2999, 2999, 2999, 'magic',     'shine',   '/animations/gifts/mermaid-shine.svg',     'svg', '/__l5e/assets-v1/093ea262-5d26-4a7b-b5c8-4ab7e1b2d2f7/42_mermaid.png',        42, true, true),
  ('Cloud Castle',      '🏰',  '🏰', 6999, 6999, 6999, 'legendary', 'shine',   '/animations/gifts/cloud-castle.svg',      'svg', '/__l5e/assets-v1/8685dd42-1568-4aa6-8980-e7a188635ab4/43_castle.png',         43, true, true),
  ('Panda Bamboo',      '🐼',  '🐼',  249,  249,  249,  'love',      'pulse',   '/animations/gifts/panda-bamboo.svg',      'svg', '/__l5e/assets-v1/e1f00bc8-42bb-438e-8a7f-d13f16d57af9/44_panda_bamboo.png',    44, true, true),
  ('Ruby Heart',        '❤️',   '❤️',  1299, 1299, 1299, 'love',      'pulse',   '/animations/gifts/ruby-heart.svg',        'svg', '/__l5e/assets-v1/ebde6ac7-a8d0-49de-9170-4fd8e6004a63/45_ruby_heart.png',     45, true, true),
  ('Golden Peacock',    '🦚',  '🦚', 4499, 4499, 4499, 'luxury',    'shine',   '/animations/gifts/golden-peacock.svg',    'svg', '/__l5e/assets-v1/37f45896-742b-4ffa-a3f1-51dc044d00b9/46_peacock.png',        46, true, true),
  ('Genie Lamp',        '🪔',  '🪔', 1799, 1799, 1799, 'magic',     'swirl',   '/animations/gifts/genie-lamp.svg',        'svg', '/__l5e/assets-v1/4109b92e-9d17-4d9e-a1f9-eaf5fc0102d1/47_genie_lamp.png',     47, true, true),
  ('Rose Bouquet',      '💐',  '💐',  599,  599,  599,  'love',      'float',   '/animations/gifts/rose-bouquet.svg',      'svg', '/__l5e/assets-v1/1f00c96d-c157-4877-b97a-a89a690e7e76/48_rose_bouquet.png',    48, true, true),
  ('Shooting Star',     '🌠',  '🌠',  699,  699,  699,  'magic',     'zoom',    '/animations/gifts/shooting-star.svg',     'svg', '/__l5e/assets-v1/02f23467-25e6-4594-92ee-b4fe6ff11dd1/49_shooting_star.png',  49, true, true),
  ('Royal Scepter',     '👑',  '👑', 7999, 7999, 7999, 'mythic',    'shine',   '/animations/gifts/royal-scepter.svg',     'svg', '/__l5e/assets-v1/b6d48be4-fcb4-4d75-a743-09ddcfec3acd/50_scepter.png',        50, true, true)
ON CONFLICT DO NOTHING;
