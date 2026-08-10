-- 0311: Fix "permission denied for table mini_game*" — Data API grants were missing.
--
-- Root cause: mini_games had a `mini_games admin` RLS policy for ALL commands and
-- mini_game_flags had an admin SELECT policy, but PostgREST roles were never granted
-- the matching table privileges, so every admin write (create/edit/enable/order) and
-- every flags read failed with `permission denied for table ...`.
-- RLS stays fully enabled; these grants only let the existing policies be evaluated.

-- Catalog: public read (enabled games), admin writes via `mini_games admin` policy.
GRANT SELECT ON public.mini_games TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mini_games TO authenticated;
GRANT ALL ON public.mini_games TO service_role;

-- Anti-abuse flags: admin-only SELECT policy already exists.
GRANT SELECT ON public.mini_game_flags TO authenticated;
GRANT ALL ON public.mini_game_flags TO service_role;

-- Sessions / stats stay read-only for users (own rows via RLS);
-- all writes happen inside SECURITY DEFINER RPCs (mg_start_session / mg_finish_session).
GRANT SELECT ON public.mini_game_sessions TO authenticated;
GRANT SELECT ON public.mini_game_stats TO authenticated;
GRANT ALL ON public.mini_game_sessions TO service_role;
GRANT ALL ON public.mini_game_stats TO service_role;

NOTIFY pgrst, 'reload schema';
