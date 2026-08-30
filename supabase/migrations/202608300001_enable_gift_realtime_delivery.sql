-- Ensure gift sends are broadcast to every subscribed room client.
-- Realtime still respects the table's SELECT RLS policy.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'gift_sends'
  ) then
    alter publication supabase_realtime add table public.gift_sends;
  end if;
end $$;
