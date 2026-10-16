-- 0373: Expose only safe summary fields for the public Home support card.
-- Detailed caller/queue/session state is available only to authenticated users.

revoke all on function public.support_room_state() from public, anon;
grant execute on function public.support_room_state() to authenticated;

create or replace function public.support_room_public_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'config', jsonb_build_object(
      'title', c.title,
      'cover_url', c.cover_url,
      'enabled', c.enabled,
      'maintenance', c.maintenance
    ),
    'online', exists (
      select 1 from public.support_room_sessions s where s.ended_at is null
    ),
    'host_count', (
      select count(*) from public.support_room_sessions s where s.ended_at is null
    ),
    'people_count', case
      when exists (select 1 from public.support_room_sessions s where s.ended_at is null)
      then (select count(*) from public.support_room_sessions s where s.ended_at is null)
         + (select count(*) from public.support_room_seats)
      else 0
    end
  )
  from public.support_room_config c
  where c.id;
$$;

revoke all on function public.support_room_public_status() from public;
grant execute on function public.support_room_public_status() to anon, authenticated;
