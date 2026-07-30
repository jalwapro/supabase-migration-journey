-- Replace the last three image-only entrance effects with real green-screen videos.
UPDATE public.entrance_effects
SET media_type = 'video',
    media_url = 'https://project--269a4b2a-bb70-44e1-bd04-6acc825e6f84.lovable.app/__l5e/assets-v1/34ad6845-77f3-4085-84d8-4a358bf32d10/entrance-white-tiger.mp4',
    chromakey = 'green',
    duration_ms = 5000
WHERE id = 'c434aaac-3db4-4c3f-9c91-97dae172209a';

UPDATE public.entrance_effects
SET media_type = 'video',
    media_url = 'https://project--269a4b2a-bb70-44e1-bd04-6acc825e6f84.lovable.app/__l5e/assets-v1/e9c48d81-07be-4ca5-9d67-3a9a843a22b6/entrance-private-jet.mp4',
    chromakey = 'green',
    duration_ms = 5000
WHERE id = '505a0bcb-fdc7-439f-9ef3-8291b4ba4bc6';

UPDATE public.entrance_effects
SET media_type = 'video',
    media_url = 'https://project--269a4b2a-bb70-44e1-bd04-6acc825e6f84.lovable.app/__l5e/assets-v1/8e336d1e-c2f5-4c8d-bcfa-d04f724eeb3d/entrance-unicorn.mp4',
    chromakey = 'green',
    duration_ms = 5000
WHERE id = '886ad496-adb4-462c-91dc-dd047583568d';
