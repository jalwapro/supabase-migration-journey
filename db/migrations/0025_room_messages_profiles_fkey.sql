-- ============================================================================
-- Repoint room_messages.user_id FK to public.profiles so PostgREST embeds
-- like `profiles!room_messages_user_id_fkey(...)` resolve.
--
-- profiles.id is 1:1 with auth.users.id (profiles.id FK → auth.users ON DELETE
-- CASCADE), so cascading behavior is preserved transitively.
-- ============================================================================

alter table public.room_messages
  drop constraint if exists room_messages_user_id_fkey;

alter table public.room_messages
  add constraint room_messages_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

notify pgrst, 'reload schema';
