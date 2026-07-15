-- 0124 Attach ElevenLabs SFX sound_url to TikTok-style gifts
BEGIN;

UPDATE public.gifts SET sound_url = '/__l5e/assets-v1/b633a161-4533-43c8-86cc-0ee15480f5ad/tiktok-rose-storm.mp3'      WHERE name = 'Rose Storm';
UPDATE public.gifts SET sound_url = '/__l5e/assets-v1/1047bdad-45f9-45d6-a6dc-397f24f5b8c9/tiktok-lion-roar.mp3'       WHERE name = 'Lion Roar';
UPDATE public.gifts SET sound_url = '/__l5e/assets-v1/3e0e93ae-7a1f-428d-9a68-9d7d74eb8bf2/tiktok-galaxy-portal.mp3'   WHERE name = 'Galaxy Portal';
UPDATE public.gifts SET sound_url = '/__l5e/assets-v1/182fc813-51ad-4af7-af60-a6725b4bed59/tiktok-dragon-flame.mp3'    WHERE name = 'Dragon Flame';
UPDATE public.gifts SET sound_url = '/__l5e/assets-v1/82703283-2b28-420c-a205-66f3546b230a/tiktok-crown-king.mp3'      WHERE name = 'Crown King';
UPDATE public.gifts SET sound_url = '/__l5e/assets-v1/b1e8cd89-4972-4063-9300-4430a1d3c135/tiktok-heart-fireworks.mp3' WHERE name = 'Heart Fireworks';

COMMIT;
