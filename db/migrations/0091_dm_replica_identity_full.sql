-- Ensure realtime UPDATE payloads include full row (ticks, deleted_at, read_at)
alter table public.direct_messages replica identity full;
