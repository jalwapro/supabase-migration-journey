-- Ensure gift_sends and gift_events are broadcast via realtime so the
-- room UI updates gift animations and per-seat gift points instantly.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'gift_sends'
  ) then
    execute 'alter publication supabase_realtime add table public.gift_sends';
  end if;
  if to_regclass('public.gift_events') is not null and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'gift_events'
  ) then
    execute 'alter publication supabase_realtime add table public.gift_events';
  end if;
end $$;

-- REPLICA IDENTITY FULL so payload.new has all columns for the UI.
alter table public.gift_sends replica identity full;
