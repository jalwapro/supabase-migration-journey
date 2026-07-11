-- Update Rose Petals to use new green-screen chromakeyed transparent WebM + fresh thumbnail
UPDATE public.gifts
SET
  image_url = '/__l5e/assets-v1/527019a6-fa96-470e-a25c-18d3c5b95e53/rose-petals.png',
  clip_path = '/__l5e/assets-v1/95c160de-43ac-4af7-bc31-576901d011a7/rose-petals.webm',
  clip_type = 'webm'
WHERE name = 'Rose Petals';
