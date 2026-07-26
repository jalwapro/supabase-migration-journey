-- Replace popular gifts with 10 new MP4 cinematic gifts (Royal Gold + Hot Pink).
BEGIN;

-- Remove old popular gifts (gift_events/gift_sends FKs are ON DELETE SET NULL).
DELETE FROM public.gifts WHERE category = 'popular';

INSERT INTO public.gifts (name, emoji, price, diamonds_value, category, animation, clip_type, clip_path, icon_path, image_url, sort_order, is_active) VALUES
  ('Heart',      '❤️', 20,  20,  'popular', 'pop', 'mp4', '/__l5e/assets-v1/5533e48b-e138-4ceb-9f27-bc924e0578f4/01-heart.mp4',      '/__l5e/assets-v1/e5d23b73-ee2f-475b-a788-7e900d2c982d/01-heart.png',      '/__l5e/assets-v1/e5d23b73-ee2f-475b-a788-7e900d2c982d/01-heart.png',      101, true),
  ('Like',       '👍', 10,  10,  'popular', 'pop', 'mp4', '/__l5e/assets-v1/9b63c890-eb24-44a2-a7e2-e518c9a0c52a/02-like.mp4',       '/__l5e/assets-v1/1a3ba934-a468-428c-885c-f79ab49e157b/02-like.png',       '/__l5e/assets-v1/1a3ba934-a468-428c-885c-f79ab49e157b/02-like.png',       102, true),
  ('Balloon',    '🎈', 40,  40,  'popular', 'pop', 'mp4', '/__l5e/assets-v1/782338fd-79f8-4fec-b5fc-0b83a23fb090/03-balloon.mp4',    '/__l5e/assets-v1/c95bfcdb-2c5f-402a-b510-fc39e97fe271/03-balloon.png',    '/__l5e/assets-v1/c95bfcdb-2c5f-402a-b510-fc39e97fe271/03-balloon.png',    103, true),
  ('Cake',       '🎂', 120, 120, 'popular', 'pop', 'mp4', '/__l5e/assets-v1/8cc8ef09-89e5-4115-81ee-44384f4c0eed/04-cake.mp4',       '/__l5e/assets-v1/03cea87f-259e-47ba-9fd7-0f322eeba7cd/04-cake.png',       '/__l5e/assets-v1/03cea87f-259e-47ba-9fd7-0f322eeba7cd/04-cake.png',       104, true),
  ('Fire',       '🔥', 80,  80,  'popular', 'pop', 'mp4', '/__l5e/assets-v1/a87cb661-78c5-44af-8b80-115e4362c19d/05-fire.mp4',       '/__l5e/assets-v1/a80e96d9-aa2d-4255-834a-db2b3bf6e12c/05-fire.png',       '/__l5e/assets-v1/a80e96d9-aa2d-4255-834a-db2b3bf6e12c/05-fire.png',       105, true),
  ('Star',       '⭐', 100, 100, 'popular', 'pop', 'mp4', '/__l5e/assets-v1/f56ab4f7-46c0-4ca2-b317-818bd6c413c1/06-star.mp4',       '/__l5e/assets-v1/bedfce0b-5138-4b7f-962d-32ae34c51a84/06-star.png',       '/__l5e/assets-v1/bedfce0b-5138-4b7f-962d-32ae34c51a84/06-star.png',       106, true),
  ('Butterfly',  '🦋', 150, 150, 'popular', 'pop', 'mp4', '/__l5e/assets-v1/9e94374a-b290-4f91-bef0-8356aa266e1a/07-butterfly.mp4',  '/__l5e/assets-v1/e560fe72-61c3-41ee-b4a0-71f206333a3e/07-butterfly.png',  '/__l5e/assets-v1/e560fe72-61c3-41ee-b4a0-71f206333a3e/07-butterfly.png',  107, true),
  ('Sunflower',  '🌻', 60,  60,  'popular', 'pop', 'mp4', '/__l5e/assets-v1/38e78b39-ec4c-4fc3-a315-b34a8fd212be/08-sunflower.mp4',  '/__l5e/assets-v1/a2928e16-1628-4712-b071-ddc16ee314fd/08-sunflower.png',  '/__l5e/assets-v1/a2928e16-1628-4712-b071-ddc16ee314fd/08-sunflower.png',  108, true),
  ('Bunny',      '🐰', 90,  90,  'popular', 'pop', 'mp4', '/__l5e/assets-v1/0cdce646-e55c-4ecb-8eac-931d8fc8994f/09-bunny.mp4',      '/__l5e/assets-v1/b6362964-4887-45f1-9b0d-d64a3d73a25d/09-bunny.png',      '/__l5e/assets-v1/b6362964-4887-45f1-9b0d-d64a3d73a25d/09-bunny.png',      109, true),
  ('Music Note', '🎵', 70,  70,  'popular', 'pop', 'mp4', '/__l5e/assets-v1/e2934e5a-1bb6-4ce1-8456-4d0e11f824b2/10-music-note.mp4', '/__l5e/assets-v1/7cfc8df4-67b0-41e5-9fc9-b853bb810f5f/10-music-note.png', '/__l5e/assets-v1/7cfc8df4-67b0-41e5-9fc9-b853bb810f5f/10-music-note.png', 110, true);

COMMIT;
