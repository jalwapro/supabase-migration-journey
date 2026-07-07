-- Fix: PGRST schema cache missing 'text' (and related) columns on room_messages.
-- Re-runs the same guards as 0008 so environments that skipped it get repaired,
-- and forces PostgREST to reload its schema cache.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_messages' and column_name = 'text'
  ) then
    alter table public.room_messages add column text text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_messages' and column_name = 'meta'
  ) then
    alter table public.room_messages add column meta jsonb;
  end if;

  if not exists (
    select 1 from pg_type where typname = 'message_kind'
  ) then
    create type public.message_kind as enum ('chat','system','gift','join','leave');
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_messages' and column_name = 'kind'
  ) then
    alter table public.room_messages
      add column kind public.message_kind not null default 'chat';
  end if;
end$$;

-- Make sure the Data API can reach these rows.
grant select, insert on public.room_messages to authenticated;
grant select on public.room_messages to anon;
grant all on public.room_messages to service_role;

-- Force PostgREST to reload its schema cache immediately.
notify pgrst, 'reload schema';
