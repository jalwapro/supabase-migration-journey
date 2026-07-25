-- Refresh 5 luxury gifts with green-screen chromakey WebM (preserves black in subject)
UPDATE public.gifts SET
  clip_path = '/__l5e/assets-v1/05cfba0d-05c8-48b3-8277-125d0181ad35/money-gun.webm',
  image_url = '/__l5e/assets-v1/0a274343-dee5-4d40-a15c-e297ec0fecdf/money-gun.png',
  clip_type = 'webm'
WHERE name = 'Money Gun Jalwa';

UPDATE public.gifts SET
  clip_path = '/__l5e/assets-v1/a0cd49ae-4a1c-4751-bf31-00af0b3bb45f/hand-heart.webm',
  image_url = '/__l5e/assets-v1/4349253d-1bac-4e58-837c-f62e66c20d04/hand-heart.png',
  clip_type = 'webm'
WHERE name = 'Hand Heart';

UPDATE public.gifts SET
  clip_path = '/__l5e/assets-v1/2610559f-9698-4686-85a6-36832e137b8d/flower.webm',
  image_url = '/__l5e/assets-v1/37b981a7-9953-4b2d-8e62-119f3fa91f6d/flower.png',
  clip_type = 'webm'
WHERE name = 'Flower Jalwa';

UPDATE public.gifts SET
  clip_path = '/__l5e/assets-v1/a5d6a801-c4a5-4165-bd48-463c8b9bcf94/heart.webm',
  image_url = '/__l5e/assets-v1/5d060b9c-6991-4cb8-9410-1f325c74dc74/heart.png',
  clip_type = 'webm'
WHERE name = 'Heart Jalwa';

UPDATE public.gifts SET
  clip_path = '/__l5e/assets-v1/a56757c1-c6f7-4eef-b83f-269afa00f4eb/spaceship.webm',
  image_url = '/__l5e/assets-v1/6cde7d95-4142-4b61-b110-3c719572432e/spaceship.png',
  clip_type = 'webm'
WHERE name = 'Jalwa Universe Spaceship';
