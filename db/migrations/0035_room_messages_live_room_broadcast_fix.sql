-- Fix room entrance + emoji broadcast inserts for the active live room system.
-- The app uses public.live_rooms, but some deployed databases still had
-- room_messages.room_id pointing at the older public.rooms table, causing
-- every join/chat/emoji insert to fail before realtime could broadcast it.

alter table public.room_messages
  drop constraint if exists room_messages_room_id_fkey;

alter table public.room_messages
  add constraint room_messages_room_id_fkey
  foreign key (room_id) references public.live_rooms(id) on delete cascade;

-- Keep both legacy `message` and current `text` columns populated so old RPCs
-- and new UI inserts both work.
alter table public.room_messages
  alter column message set default '';

create or replace function public.sync_room_message_text()
returns trigger
language plpgsql
as $$
begin
  new.text := coalesce(new.text, nullif(new.message, ''));
  new.message := coalesce(nullif(new.message, ''), new.text, '');
  return new;
end;
$$;

drop trigger if exists sync_room_message_text_trigger on public.room_messages;
create trigger sync_room_message_text_trigger
before insert or update on public.room_messages
for each row execute function public.sync_room_message_text();

create index if not exists idx_room_messages_room_created_at
  on public.room_messages(room_id, created_at desc);

grant select on public.room_messages to anon, authenticated;
grant insert on public.room_messages to authenticated;
grant all on public.room_messages to service_role;

alter table public.room_messages enable row level security;

do $$
begin
  begin
    alter publication supabase_realtime add table public.room_messages;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

alter table public.room_messages replica identity full;

notify pgrst, 'reload schema';