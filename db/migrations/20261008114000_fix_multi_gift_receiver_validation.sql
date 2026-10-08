-- Allow gifts to active room members even when they are audience listeners.
-- A microphone seat is not required to receive a gift.

create or replace function public.send_gift_multi_current(
  _room_id uuid,
  _receiver_ids uuid[],
  _gift_id uuid,
  _quantity integer
)
returns setof public.gift_sends
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_receiver uuid;
  v_seen uuid[] := array[]::uuid[];
begin
  if v_sender is null then raise exception 'Not authenticated'; end if;
  if _room_id is null or _gift_id is null then raise exception 'Gift parameters are required'; end if;
  if _receiver_ids is null or cardinality(_receiver_ids) < 1 or cardinality(_receiver_ids) > 20 then raise exception 'Invalid receiver count'; end if;
  if _quantity is null or _quantity < 1 or _quantity > 100 then raise exception 'Invalid quantity'; end if;

  foreach v_receiver in array _receiver_ids loop
    if v_receiver is null or v_receiver = v_sender then
      raise exception 'Invalid gift receiver';
    end if;
    if v_receiver = any(v_seen) then
      continue;
    end if;
    v_seen := array_append(v_seen, v_receiver);

    if not exists (
      select 1
      from public.room_members rm
      where rm.room_id = _room_id
        and rm.user_id = v_receiver
    )
    and not exists (
      select 1
      from public.live_rooms r
      where r.id = _room_id
        and r.host_id = v_receiver
    ) then
      raise exception 'Receiver is not an active member of this room';
    end if;

    return next public.send_gift(_room_id, v_receiver, _gift_id, _quantity, false);
  end loop;

  if cardinality(v_seen) < 1 then raise exception 'Pick a receiver'; end if;
  return;
end;
$$;

revoke all on function public.send_gift_multi_current(uuid,uuid[],uuid,integer) from public, anon;
grant execute on function public.send_gift_multi_current(uuid,uuid[],uuid,integer) to authenticated;
