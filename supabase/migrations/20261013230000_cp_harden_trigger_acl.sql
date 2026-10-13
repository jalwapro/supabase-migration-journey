-- Internal trigger functions must not be callable as PostgREST RPC endpoints.
begin;
revoke execute on function public.cp_apply_romantic_gift_intimacy() from public, anon, authenticated;
revoke execute on function public.cp_track_prelink_romantic_gift() from public, anon, authenticated;
commit;
