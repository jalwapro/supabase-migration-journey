-- Ensure room_messages has all expected columns (fixes PGRST schema-cache errors
-- on environments where an older version of the table was created before
-- migration 0002 added `text`, `kind`, `meta`).

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

-- Force PostgREST to reload its schema cache
notify pgrst, 'reload schema';
