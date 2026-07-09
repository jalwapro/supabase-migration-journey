-- User provided fresh Agora App ID + Primary Certificate via env vars
-- (AGORA_APP_ID_NEW / AGORA_APP_CERT_NEW). Server now reads env vars first,
-- so purge all old slot rows so nothing stale can win the pool lookup.
DELETE FROM public.agora_slots;
