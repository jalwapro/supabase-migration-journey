-- 0082 Attach next 5 MP4 clips
BEGIN;
UPDATE public.gifts SET clip_path='/__l5e/assets-v1/84016432-d814-4c67-af84-8e3d0b2a25fe/jalwa-universe-emperor.mp4', clip_type='mp4' WHERE name='Jalwa Universe Emperor';
UPDATE public.gifts SET clip_path='/__l5e/assets-v1/60594269-1197-478d-8e08-dbacce21681b/jalwa-heavens-gate.mp4', clip_type='mp4' WHERE name='Jalwa Heaven''s Gate';
UPDATE public.gifts SET clip_path='/__l5e/assets-v1/17fcd71c-652c-477c-bd23-6718b95ebe4a/jalwa-celestial-queen.mp4', clip_type='mp4' WHERE name='Jalwa Celestial Queen';
UPDATE public.gifts SET clip_path='/__l5e/assets-v1/98464ca7-c3e2-4ddf-ad50-2d7a2fdafb10/jalwa-eternal-throne.mp4', clip_type='mp4' WHERE name='Jalwa Eternal Throne';
UPDATE public.gifts SET clip_path='/__l5e/assets-v1/59d9be56-b221-43fd-a197-f1ea77fdccd9/jalwa-infinity-heart.mp4', clip_type='mp4' WHERE name='Jalwa Infinity Heart';
COMMIT;
SELECT count(*) FROM public.gifts WHERE clip_type='mp4';