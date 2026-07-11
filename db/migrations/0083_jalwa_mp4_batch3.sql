-- 0083 Attach MP4 batch 3
BEGIN;
UPDATE public.gifts SET clip_path='/__l5e/assets-v1/84facc99-39da-4862-bdab-2283f270df2f/jalwa-trident-of-kings.mp4', clip_type='mp4' WHERE name='Jalwa Trident of Kings';
UPDATE public.gifts SET clip_path='/__l5e/assets-v1/de0bc1a7-a49e-4bbe-972b-8afaf921e9bf/jalwa-supernova.mp4', clip_type='mp4' WHERE name='Jalwa Supernova';
UPDATE public.gifts SET clip_path='/__l5e/assets-v1/285f1036-51b9-4ab0-8da7-f54df55065bc/jalwa-guardian-angel.mp4', clip_type='mp4' WHERE name='Jalwa Guardian Angel';
UPDATE public.gifts SET clip_path='/__l5e/assets-v1/b4488e58-2a16-4171-8341-8a2844bdef45/jalwa-nebula-rose.mp4', clip_type='mp4' WHERE name='Jalwa Nebula Rose';
UPDATE public.gifts SET clip_path='/__l5e/assets-v1/6038c3cc-6e9b-46fb-81c1-37c18b9d2c01/jalwa-thunder-god.mp4', clip_type='mp4' WHERE name='Jalwa Thunder God';
COMMIT;
SELECT count(*) FROM public.gifts WHERE clip_type='mp4';