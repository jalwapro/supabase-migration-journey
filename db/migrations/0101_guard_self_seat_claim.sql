-- Restrict self-claiming a seat: a normal user cannot set their own seat_index
-- unless host/moderator, or they have an accepted seat_invite (RPC path).
-- Host/mod actions and SECURITY DEFINER RPCs still work: host_id owner and
-- moderators are exempt, and accept_seat_invite / accept_video_swap_invite
-- create an 'accepted' invite row before inserting the seat.

create or replace function public.trg_guard_self_seat_claim() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  is_host boolean;
  is_mod boolean;
  has_invite boolean;
  old_seat int;
begin
  -- Only care about the acting-as-self case.
  if me is null or NEW.user_id <> me then
    return NEW;
  end if;

  old_seat := case when TG_OP = 'UPDATE' then OLD.seat_index else null end;

  -- Leaving/clearing seat is always allowed.
  if NEW.seat_index is null then
    return NEW;
  end if;

  -- No change in seat_index on UPDATE → allow.
  if TG_OP = 'UPDATE' and old_seat is not distinct from NEW.seat_index then
    return NEW;
  end if;

  -- Host of the room is exempt.
  select (r.host_id = me) into is_host
    from public.live_rooms r where r.id = NEW.room_id;
  if coalesce(is_host, false) then return NEW; end if;

  -- Moderator of the room is exempt.
  select coalesce(m.is_moderator, false) into is_mod
    from public.room_members m
    where m.room_id = NEW.room_id and m.user_id = me;
  if coalesce(is_mod, false) then return NEW; end if;

  -- Must have an accepted invite for this room (matching seat or open seat).
  select exists(
    select 1 from public.seat_invites si
    where si.room_id = NEW.room_id
      and si.to_user = me
      and si.status = 'accepted'
      and (si.seat_index is null or si.seat_index = NEW.seat_index)
      and si.responded_at > now() - interval '30 seconds'
  ) into has_invite;

  if not has_invite then
    raise exception 'seat requires host or moderator invite'
      using errcode = '42501';
  end if;

  return NEW;
end $$;

drop trigger if exists trg_guard_self_seat_claim_ins on public.room_members;
create trigger trg_guard_self_seat_claim_ins
  before insert on public.room_members
  for each row execute function public.trg_guard_self_seat_claim();

drop trigger if exists trg_guard_self_seat_claim_upd on public.room_members;
create trigger trg_guard_self_seat_claim_upd
  before update of seat_index on public.room_members
  for each row execute function public.trg_guard_self_seat_claim();
