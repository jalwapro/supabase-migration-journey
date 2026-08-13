-- Keep the Studio pointed at routes that actually exist in the app.
-- The /profile route is a safe alias to the existing authenticated /me profile.
UPDATE public.app_customization_pages
SET route_pattern = '/me', updated_at = NOW()
WHERE page_key = 'profile';

-- Dynamic room pages are intentionally left as templates. The Studio must resolve
-- :roomId to a real UUID instead of sending preview-voice/preview-video/preview-pk.
UPDATE public.app_customization_pages
SET route_pattern = '/room/:roomId', updated_at = NOW()
WHERE page_key IN ('voice-room','video-room','pk-battle');
