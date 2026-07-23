-- ============================================================================
-- 0155 — Force PostgREST schema reload for touch_presence()
-- Migration 0152 defined the RPC + grant, but the deployed schema cache still
-- returns PGRST202 (404) for public.touch_presence. Redeclare + reload so the
-- 15s presence heartbeat stops spamming 404s (room network noise + latency).
-- ============================================================================

create or replace function public.touch_presence()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then return; end if;
  insert into public.user_presence(user_id, last_seen_at)
    values (me, now())
  on conflict (user_id) do update set last_seen_at = excluded.last_seen_at;
end $$;

grant execute on function public.touch_presence() to authenticated;

notify pgrst, 'reload schema';
