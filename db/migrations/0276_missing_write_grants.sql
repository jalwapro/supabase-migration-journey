-- 0276: Data API write grants for tables whose RLS policies allow admin writes
-- but which only had SELECT granted to `authenticated` (=> "permission denied").

GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_top_frames TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entrance_effects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pk_champions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spin_prizes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_reports TO authenticated;

GRANT ALL ON public.room_top_frames TO service_role;
GRANT ALL ON public.entrance_effects TO service_role;
GRANT ALL ON public.notifications TO service_role;
GRANT ALL ON public.pk_champions TO service_role;
GRANT ALL ON public.profile_cards TO service_role;
GRANT ALL ON public.spin_prizes TO service_role;
GRANT ALL ON public.user_reports TO service_role;
