-- Gift #5: Teddy Bear — 400 coins, love category, transparent WebM + chime SFX
INSERT INTO public.gifts (name, emoji, icon, image_url, price, price_coins, diamonds_value, category, animation, clip_path, clip_type, sound_url, sort_order, is_active, active)
VALUES (
  'Teddy Bear',
  '🧸',
  '🧸',
  '/__l5e/assets-v1/e55e2462-f197-49b0-9835-3282f0cc91dd/teddy-bear.png',
  400,
  400,
  40,
  'love',
  'teddy-hug',
  '/__l5e/assets-v1/f72d361c-f6a7-410c-bfd4-b3fea227da2a/teddy-bear.webm',
  'webm',
  '/__l5e/assets-v1/a5afd000-0730-4d83-ae3a-a73bc32c7d8b/teddy-bear.mp3',
  5,
  true,
  true
)
ON CONFLICT DO NOTHING;
