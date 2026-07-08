-- ============================================================================
-- Enable realtime for room tables so seat changes, likes, gifts and live_rooms
-- updates propagate instantly to every viewer without refresh.
-- ============================================================================

do $$
declare
  t text;
  tables text[] := array[
    'room_members',
    'room_seat_likes',
    'gift_sends',
    'live_rooms',
    'room_messages'
  ];
begin
  foreach t in array tables loop
    -- Ensure REPLICA IDENTITY FULL so UPDATE/DELETE payloads carry old row
    -- (needed for seat_index changes to be visible to clients).
    if exists (select 1 from pg_class where relname = t and relnamespace = 'public'::regnamespace) then
      execute format('alter table public.%I replica identity full', t);
    end if;

    -- Add to supabase_realtime publication if not already present.
    if exists (select 1 from pg_class where relname = t and relnamespace = 'public'::regnamespace)
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = t
       )
    then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
