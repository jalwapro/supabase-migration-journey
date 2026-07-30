-- Real green-screen cinematic videos for the six flagship entrance effects.
-- Chromakey 'green' so the room player keys the background out to transparent.

UPDATE public.entrance_effects SET media_type='mp4', chromakey='green', duration_ms=5000, updated_at=now(),
  media_url='/__l5e/assets-v1/7482f93f-d220-45a8-bf47-e7306d7ef2ef/entrance-dragon.mp4'  WHERE name='Flying Dragon';
UPDATE public.entrance_effects SET media_type='mp4', chromakey='green', duration_ms=5000, updated_at=now(),
  media_url='/__l5e/assets-v1/8fad2eca-f8e4-4da7-832f-9802d37e0c71/entrance-car.mp4'     WHERE name='Luxury Sports Car';
UPDATE public.entrance_effects SET media_type='mp4', chromakey='green', duration_ms=5000, updated_at=now(),
  media_url='/__l5e/assets-v1/e2f5f6e8-0ed1-439f-82f5-0f11ce2d8bf7/entrance-phoenix.mp4' WHERE name='Phoenix Rebirth';
UPDATE public.entrance_effects SET media_type='mp4', chromakey='green', duration_ms=5000, updated_at=now(),
  media_url='/__l5e/assets-v1/b21545bb-a7ac-4c44-8470-42ab8b884929/entrance-throne.mp4'  WHERE name='King Throne';
UPDATE public.entrance_effects SET media_type='mp4', chromakey='green', duration_ms=5000, updated_at=now(),
  media_url='/__l5e/assets-v1/9012f76a-24ba-4302-b98c-96f53256da54/entrance-lion.mp4'    WHERE name='Golden Lion';
UPDATE public.entrance_effects SET media_type='mp4', chromakey='green', duration_ms=5000, updated_at=now(),
  media_url='/__l5e/assets-v1/9cac2d93-3c38-4d88-8f7f-0082ac02fd9a/entrance-yacht.mp4'   WHERE name='Luxury Yacht';
