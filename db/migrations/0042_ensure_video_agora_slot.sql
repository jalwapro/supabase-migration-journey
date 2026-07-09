-- Ensure a video Agora slot exists mirroring the voice slot credentials.
-- User only added voice slot in admin panel; video rooms need a video slot too.
INSERT INTO agora_slots (kind, slot_index, label, app_id, app_certificate, minutes_quota, is_active)
SELECT 'video', 1, 'v', app_id, app_certificate, 10000, true
FROM agora_slots
WHERE kind = 'voice' AND slot_index = 1
ON CONFLICT (kind, slot_index) DO UPDATE SET
  app_id = EXCLUDED.app_id,
  app_certificate = EXCLUDED.app_certificate,
  is_active = true,
  updated_at = now();
