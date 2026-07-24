-- ============================================================================
-- 0165 — Add 'host_disconnected' to room_status enum
-- Must be a standalone migration because Postgres cannot use a newly added
-- enum value in the same transaction that added it.
-- ============================================================================

do $$
begin
  if not exists (
    select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'room_status'
       and e.enumlabel = 'host_disconnected'
  ) then
    alter type public.room_status add value 'host_disconnected';
  end if;
end $$;

notify pgrst, 'reload schema';
