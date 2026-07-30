-- Fix broken seeded frame URLs (asset IDs never existed on the CDN) and add a
-- 12-frame premium library the admin can assign to Home top-1 / top-2 slots.

UPDATE public.room_top_frames
   SET media_url = '/__l5e/assets-v1/048d4079-367d-4372-b603-d9654f3680e1/room-frame-01.png',
       media_type = 'png', chromakey = 'none', updated_at = now()
 WHERE slot = 1;

UPDATE public.room_top_frames
   SET media_url = '/__l5e/assets-v1/0969dbbe-c7e0-4db4-aa69-cc56d25364d0/room-frame-10.png',
       media_type = 'png', chromakey = 'none', updated_at = now()
 WHERE slot = 2;

INSERT INTO public.room_top_frames (name, media_url, media_type, chromakey, slot, sort_order)
SELECT v.name, v.url, 'png', 'none', 0, v.ord
FROM (VALUES
  ('Royal Gold Crown',   '/__l5e/assets-v1/048d4079-367d-4372-b603-d9654f3680e1/room-frame-01.png', 1),
  ('Neon Violet Crystal','/__l5e/assets-v1/8d137c9e-af2c-463e-9f0a-e0c7dbb3bccb/room-frame-02.png', 2),
  ('Dragon Emperor',     '/__l5e/assets-v1/afe79216-232d-4be8-a411-4cb49d1e88ac/room-frame-03.png', 3),
  ('Ice Diamond',        '/__l5e/assets-v1/66b9006e-bf1a-4b45-a239-98c52a7ad156/room-frame-04.png', 4),
  ('Rose Love',          '/__l5e/assets-v1/f2a73ae2-2ba5-4a1a-b528-1c9cdfd29b2d/room-frame-05.png', 5),
  ('Fire Phoenix',       '/__l5e/assets-v1/f40e94c1-1208-4f47-8908-91848081e8ba/room-frame-06.png', 6),
  ('Emerald Peacock',    '/__l5e/assets-v1/b49ab0c1-334a-42dc-84b9-9d5e9c476365/room-frame-07.png', 7),
  ('Angel Wings',        '/__l5e/assets-v1/bee2cd9a-05b2-4742-9aeb-d51a6e5de4bb/room-frame-08.png', 8),
  ('Cyber Neon',         '/__l5e/assets-v1/847f3980-05ca-4a15-a79e-a82b03f4f06a/room-frame-09.png', 9),
  ('Royal Purple Velvet','/__l5e/assets-v1/0969dbbe-c7e0-4db4-aa69-cc56d25364d0/room-frame-10.png', 10),
  ('Champion Laurel',    '/__l5e/assets-v1/cea9f7f5-9857-4023-b428-2786d4e04c8b/room-frame-11.png', 11),
  ('Galaxy Moon',        '/__l5e/assets-v1/5007410d-bf68-45d8-8f0c-0fb3f82a14c1/room-frame-12.png', 12)
) AS v(name, url, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM public.room_top_frames f WHERE f.media_url = v.url AND f.slot = 0
);
