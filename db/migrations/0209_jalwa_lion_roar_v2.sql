-- Jalwa Lion Roar v2 — side-angle cinematic clip, lion emerges from cave, runs, then roars.
-- Video already has chromakey'd transparent background (VP9 alpha).
-- Roar audio delayed to ~2.9s so sound only fires at the roar moment, not before.
UPDATE public.gifts
SET
  clip_path = '/__l5e/assets-v1/8abd720f-e1f5-47ed-9b2e-11c67d5f6178/jalwa-lion-roar-v2.webm',
  clip_type = 'webm',
  sound_url = '/__l5e/assets-v1/2cf217cb-4452-4251-89b7-8f3cd2d77391/jalwa-lion-roar-delayed.mp3',
  icon_path = '/__l5e/assets-v1/8abd720f-e1f5-47ed-9b2e-11c67d5f6178/jalwa-lion-roar-v2.webm',
  is_active = true
WHERE name = 'Jalwa Lion Roar';
