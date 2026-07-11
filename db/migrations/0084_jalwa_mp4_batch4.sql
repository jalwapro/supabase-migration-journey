-- 0084 Attach MP4 batch 4
BEGIN;
UPDATE public.gifts SET clip_path='/__l5e/assets-v1/9e3006df-7643-49c7-80de-7bd1ba038325/jalwa-astral-bloom.mp4', clip_type='mp4' WHERE name='Jalwa Astral Bloom';
UPDATE public.gifts SET clip_path='/__l5e/assets-v1/24bb9a79-2c48-41f5-b5fa-555ec054d238/jalwa-cosmic-comet.mp4', clip_type='mp4' WHERE name='Jalwa Cosmic Comet';
UPDATE public.gifts SET clip_path='/__l5e/assets-v1/015eca02-bef2-45b0-b57a-eb817619fb22/jalwa-rainbow-prism.mp4', clip_type='mp4' WHERE name='Jalwa Rainbow Prism';
UPDATE public.gifts SET clip_path='/__l5e/assets-v1/1b634e68-4628-4582-b58e-85e242a0523c/jalwa-eternal-flame.mp4', clip_type='mp4' WHERE name='Jalwa Eternal Flame';
UPDATE public.gifts SET clip_path='/__l5e/assets-v1/e4da843f-1be0-478e-9e29-b02722afab06/jalwa-ringed-planet.mp4', clip_type='mp4' WHERE name='Jalwa Ringed Planet';
COMMIT;
SELECT count(*) FROM public.gifts WHERE clip_type='mp4';