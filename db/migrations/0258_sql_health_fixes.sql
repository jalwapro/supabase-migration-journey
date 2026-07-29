-- 0258: SQL health fixes found during full audit.
-- spotlight_* tables were missing the service_role grant (edge/admin paths).

GRANT ALL ON public.spotlight_animations TO service_role;
GRANT ALL ON public.spotlight_triggers TO service_role;
