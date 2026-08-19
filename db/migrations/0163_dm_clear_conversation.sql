-- Real private-chat Clear Chat operation.
-- Permanently clears the complete conversation between the authenticated user and peer.
-- This is intentionally explicit/destructive; the UI must confirm before calling it.

begin;

create or replace function public.clear_dm_conversation(_peer_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  removed integer := 0;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if _peer_id is null or _peer_id = me then
    raise exception 'Invalid conversation peer';
  end if;

  -- Only the two participants can clear their own conversation.
  delete from public.direct_messages
   where (sender_id = me and recipient_id = _peer_id)
      or (sender_id = _peer_id and recipient_id = me);

  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.clear_dm_conversation(uuid) from public;
grant execute on function public.clear_dm_conversation(uuid) to authenticated;

commit;
