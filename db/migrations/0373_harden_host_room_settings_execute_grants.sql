-- Keep the Host Room Settings RPC callable only by signed-in users.
-- Authorization remains enforced inside the SECURITY DEFINER function via auth.uid() = live_rooms.host_id.
revoke execute on function public.host_update_room_settings(uuid,boolean,boolean,boolean,boolean) from public;
grant execute on function public.host_update_room_settings(uuid,boolean,boolean,boolean,boolean) to authenticated;
