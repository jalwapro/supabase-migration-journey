-- 0081 Attach MP4 clips to top mythic gifts
BEGIN;
UPDATE public.gifts SET clip_path='/__l5e/assets-v1/c451b93e-97b3-4798-a99d-d1fa72e82ea1/jalwa-dragon-emperor.mp4', clip_type='mp4' WHERE name='Jalwa Dragon Emperor';
UPDATE public.gifts SET clip_path='/__l5e/assets-v1/edd0d0cb-87cc-4565-be54-43b0c88e417b/jalwa-phoenix-empress.mp4', clip_type='mp4' WHERE name='Jalwa Phoenix Empress';
UPDATE public.gifts SET clip_path='/__l5e/assets-v1/3b83867b-126f-4a93-975b-e2265724c87b/jalwa-galaxy.mp4', clip_type='mp4' WHERE name='Jalwa Galaxy';
UPDATE public.gifts SET clip_path='/__l5e/assets-v1/82edef27-b3a9-4f72-954a-57670ba383c3/jalwa-grand-fireworks.mp4', clip_type='mp4' WHERE name='Jalwa Grand Fireworks';
UPDATE public.gifts SET clip_path='/__l5e/assets-v1/ddce825b-070d-4be4-a66a-fecd9f2056d7/jalwa-jalwa-e-noor.mp4', clip_type='mp4' WHERE name='Jalwa Jalwa-e-Noor';
COMMIT;
SELECT name, clip_type, clip_path FROM public.gifts WHERE clip_type='mp4';