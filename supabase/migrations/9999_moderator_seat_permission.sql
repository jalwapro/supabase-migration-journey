-- JALWA Voice Room: host-controlled moderator seat moderation permission
-- This migration is intentionally additive and does not alter existing seat ownership data.

alter table if exists public.rooms
  add column if not exists moderator_can_manage_seats boolean not null default false;

comment on column public.rooms.moderator_can_manage_seats is
  'When true, room moderators may perform basic seat lock/unlock actions. Host-only setting.';

create or replace function public.set_moderator_seat_permission(
  _room_id uuid,
  _enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _is_host boolean;
begin
  if _uid is null then
    raise exception 'Not authenticated';
  end if;

  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = _room_id
      and rm.user_id = _uid
      and (rm.is_host = true or rm.role = 'host')
  ) into _is_host;

  if not _is_host then
    raise exception 'Only the room host can change moderator seat permissions';
  end if;

  update public.rooms
  set moderator_can_manage_seats = _enabled
  where id = _room_id;

  if not found then
    raise exception 'Room not found';
  end if;

  return _enabled;
end;
$$;

grant execute on function public.set_moderator_seat_permission(uuid, boolean) to authenticated;
