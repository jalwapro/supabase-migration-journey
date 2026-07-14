-- Scale fix: denormalize sender profile onto room_messages so realtime
-- consumers don't do a per-message profiles lookup. In a 5k-viewer room
-- with 50 msgs/sec, the N+1 was 250k profile queries/sec.
--
-- Strategy: add columns, backfill, and install a BEFORE INSERT trigger that
-- auto-populates from profiles. Existing insert code (client + send_gift RPC)
-- keeps working with zero changes.

ALTER TABLE public.room_messages
  ADD COLUMN IF NOT EXISTS sender_username text,
  ADD COLUMN IF NOT EXISTS sender_avatar   text,
  ADD COLUMN IF NOT EXISTS sender_level    int;

-- Backfill existing rows once.
UPDATE public.room_messages m
   SET sender_username = p.username,
       sender_avatar   = p.avatar,
       sender_level    = p.level
  FROM public.profiles p
 WHERE m.user_id = p.id
   AND m.sender_username IS NULL;

-- Auto-populate on insert.
CREATE OR REPLACE FUNCTION public.room_messages_fill_sender()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.sender_username IS NULL THEN
    SELECT username, avatar, level
      INTO NEW.sender_username, NEW.sender_avatar, NEW.sender_level
      FROM public.profiles
     WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_room_messages_fill_sender ON public.room_messages;
CREATE TRIGGER trg_room_messages_fill_sender
  BEFORE INSERT ON public.room_messages
  FOR EACH ROW EXECUTE FUNCTION public.room_messages_fill_sender();

NOTIFY pgrst, 'reload schema';
