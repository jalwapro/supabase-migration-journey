-- ============================================================================
-- 0232 — admin_end_room RPC
-- Reliable server-side force-end for admin panel. Bypasses any client-side
-- RLS quirks, cascades cleanup of live members, logs the action.
-- ============================================================================

create or replace function public.admin_end_room(_room_id uuid, _reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not public.is_admin(me) then raise exception 'admin only'; end if;

  update public.live_rooms
     set status   = 'ended',
         ended_at = now()
   where id = _room_id
     and status <> 'ended';

  -- best-effort: clear live members so viewer counts recompute correctly
  begin
    delete from public.room_members where room_id = _room_id;
  exception when others then null;
  end;

  insert into public.admin_logs (admin_id, action, target, details)
    values (me, 'admin_end_room', _room_id::text,
            jsonb_build_object('reason', coalesce(_reason, 'admin panel')));
end $$;

grant execute on function public.admin_end_room(uuid, text) to authenticated;

notify pgrst, 'reload schema';
