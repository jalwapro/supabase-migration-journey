-- 0350 — Production Voice Room membership/seat security and chat moderation.
-- Host exit semantics are already provided by leave_room_as_host(_room_id, _end_now).

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
  if me is null or NEW.user_id <> me then return NEW; end if;
  old_seat := case when TG_OP = 'UPDATE' then OLD.seat_index else null end;
  if NEW.seat_index is null then return NEW; end if;
  if TG_OP = 'UPDATE' and old_seat is not distinct from NEW.seat_index then return NEW; end if;
  select (r.host_id = me) into is_host from public.live_rooms r where r.id = NEW.room_id;
  if coalesce(is_host, false) then return NEW; end if;
  select coalesce(m.is_moderator, false) into is_mod
    from public.room_members m where m.room_id = NEW.room_id and m.user_id = me;
  if coalesce(is_mod, false) then return NEW; end if;
  select exists(
    select 1 from public.seat_invites si
    where si.room_id = NEW.room_id
      and si.to_user = me
      and si.status = 'accepted'
      and (si.seat_index is null or si.seat_index = NEW.seat_index)
      and si.responded_at > now() - interval '30 seconds'
  ) into has_invite;
  if not has_invite then
    raise exception 'seat requires host or moderator invite' using errcode = '42501';
  end if;
  return NEW;
end $$;

drop trigger if exists trg_guard_self_seat_claim_ins on public.room_members;
create trigger trg_guard_self_seat_claim_ins before insert on public.room_members for each row execute function public.trg_guard_self_seat_claim();
drop trigger if exists trg_guard_self_seat_claim_upd on public.room_members;
create trigger trg_guard_self_seat_claim_upd before update of seat_index on public.room_members for each row execute function public.trg_guard_self_seat_claim();

drop policy if exists "user manages own membership" on public.room_members;
drop policy if exists "user leaves own membership" on public.room_members;
create policy "user leaves own membership" on public.room_members for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Host and moderators can delete room messages" on public.room_messages;
create policy "Host and moderators can delete room messages" on public.room_messages for delete to authenticated using (
  exists (select 1 from public.live_rooms r where r.id = room_messages.room_id and r.host_id = auth.uid())
  or exists (select 1 from public.room_members m where m.room_id = room_messages.room_id and m.user_id = auth.uid() and coalesce(m.is_moderator, false) = true)
  or public.is_admin(auth.uid())
);

alter table public.room_members replica identity full;
alter table public.room_messages replica identity full;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='room_members') then
    execute 'alter publication supabase_realtime add table public.room_members';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='room_messages') then
    execute 'alter publication supabase_realtime add table public.room_messages';
  end if;
end $$;

notify pgrst, 'reload schema';
