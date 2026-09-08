-- Remove implicit PUBLIC EXECUTE from the new P0 browser-facing functions.
REVOKE ALL ON FUNCTION public.create_voice_room(text,uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_voice_room(text,uuid,boolean,text) TO authenticated;
REVOKE ALL ON FUNCTION public.leaderboard(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leaderboard(text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.send_gift(uuid,uuid,uuid,integer,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_gift(uuid,uuid,uuid,integer,boolean) TO authenticated;

-- Secret/admin functions must not be callable through the browser Data API.
REVOKE ALL ON FUNCTION public.rtc_pick_credential() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rtc_mark_exhausted(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rtc_report_usage(bigint,numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rtc_set_verify_state(integer,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.host_popularity_record_activity(uuid,integer,integer,integer,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ludo_close_match(uuid,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ludo_open_match(uuid,uuid[],integer) FROM PUBLIC, anon;
