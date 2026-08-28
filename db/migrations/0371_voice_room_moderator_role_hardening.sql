-- 0371 — Dedicated room-scoped Moderator role
-- HOST > MODERATOR > USER. No Co-Host role.
alter table public.live_rooms add column if not exists moderator_can_manage_seats boolean not null default false;

create or replace function public.set_room_moderator(_room_id uuid, _user_id uuid, _is_moderator boolean)
returns boolean language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); r_host uuid; ok boolean;
begin
 if me is null then raise exception 'not authenticated'; end if;
 select host_id into r_host from public.live_rooms where id=_room_id;
 if r_host is null then raise exception 'room not found'; end if;
 if me<>r_host then raise exception 'only the host can manage moderators'; end if;
 if _user_id=r_host then raise exception 'host cannot be a moderator'; end if;
 select exists(select 1 from public.room_members where room_id=_room_id and user_id=_user_id) into ok;
 if not ok then raise exception 'user is not a room member'; end if;
 update public.room_members set is_moderator=_is_moderator where room_id=_room_id and user_id=_user_id;
 return _is_moderator;
end $$;
grant execute on function public.set_room_moderator(uuid,uuid,boolean) to authenticated;

create or replace function public.set_moderator_seat_management(_room_id uuid,_enabled boolean)
returns boolean language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); r_host uuid;
begin
 if me is null then raise exception 'not authenticated'; end if;
 select host_id into r_host from public.live_rooms where id=_room_id;
 if me<>r_host then raise exception 'only the host can change moderator seat permission'; end if;
 update public.live_rooms set moderator_can_manage_seats=_enabled where id=_room_id;
 return _enabled;
end $$;
grant execute on function public.set_moderator_seat_management(uuid,boolean) to authenticated;

create or replace function public._voice_room_moderation_guard(_room_id uuid,_target_user uuid)
returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); r_host uuid; actor_mod boolean; target_mod boolean; exists_target boolean;
begin
 if me is null then raise exception 'not authenticated'; end if;
 select host_id into r_host from public.live_rooms where id=_room_id;
 if r_host is null then raise exception 'room not found'; end if;
 if me<>r_host then
   select coalesce(is_moderator,false) into actor_mod from public.room_members where room_id=_room_id and user_id=me;
   if not actor_mod then raise exception 'only host or moderator can moderate'; end if;
   if _target_user=r_host then raise exception 'moderator cannot moderate the host'; end if;
   select coalesce(is_moderator,false) into target_mod from public.room_members where room_id=_room_id and user_id=_target_user;
   if target_mod then raise exception 'moderator cannot moderate another moderator'; end if;
 end if;
 select exists(select 1 from public.room_members where room_id=_room_id and user_id=_target_user) into exists_target;
 if not exists_target and _target_user<>r_host then raise exception 'target is not a room member'; end if;
end $$;

create or replace function public.moderate_room_user(_room_id uuid,_target_user uuid,_action text)
returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); r_host uuid; actor_mod boolean;
begin
 if _action not in ('mute','unmute','kick','ban') then raise exception 'unsupported moderation action'; end if;
 select host_id into r_host from public.live_rooms where id=_room_id;
 if r_host is null then raise exception 'room not found'; end if;
 if me<>r_host then
   select coalesce(is_moderator,false) into actor_mod from public.room_members where room_id=_room_id and user_id=me;
   if not actor_mod then raise exception 'only host or moderator can moderate'; end if;
 end if;
 perform public._voice_room_moderation_guard(_room_id,_target_user);
 if _action='mute' then update public.room_members set is_muted=true where room_id=_room_id and user_id=_target_user;
 elsif _action='unmute' then update public.room_members set is_muted=false where room_id=_room_id and user_id=_target_user;
 elsif _action='kick' then perform public.kick_from_room(_room_id,_target_user,30);
 elsif _action='ban' then
   insert into public.room_bans(room_id,user_id,banned_by,expires_at,reason) values(_room_id,_target_user,me,now()+interval '30 days','Room moderation')
   on conflict(room_id,user_id) do update set banned_by=excluded.banned_by,expires_at=excluded.expires_at,reason=excluded.reason;
   delete from public.room_members where room_id=_room_id and user_id=_target_user;
 end if;
end $$;
grant execute on function public.moderate_room_user(uuid,uuid,text) to authenticated;

create or replace function public.moderate_delete_room_message(_room_id uuid,_message_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); r_host uuid; actor_mod boolean; sender_id uuid; sender_mod boolean;
begin
 select host_id into r_host from public.live_rooms where id=_room_id;
 select user_id into sender_id from public.room_messages where id=_message_id and room_id=_room_id;
 if sender_id is null then raise exception 'message not found'; end if;
 if me<>r_host then
   select coalesce(is_moderator,false) into actor_mod from public.room_members where room_id=_room_id and user_id=me;
   if not actor_mod then raise exception 'only host or moderator can remove messages'; end if;
   if sender_id=r_host then raise exception 'moderator cannot remove host messages'; end if;
   select coalesce(is_moderator,false) into sender_mod from public.room_members where room_id=_room_id and user_id=sender_id;
   if sender_mod then raise exception 'moderator cannot remove moderator messages'; end if;
 end if;
 delete from public.room_messages where id=_message_id and room_id=_room_id;
end $$;
grant execute on function public.moderate_delete_room_message(uuid,uuid) to authenticated;

create or replace function public.report_room_user_to_host(_room_id uuid,_reported_user uuid,_reason text,_details text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); rid uuid;
begin
 if me is null then raise exception 'not authenticated'; end if;
 if not exists(select 1 from public.room_members where room_id=_room_id and user_id=me) then raise exception 'not a room member'; end if;
 if not exists(select 1 from public.room_members where room_id=_room_id and user_id=_reported_user) and not exists(select 1 from public.live_rooms where id=_room_id and host_id=_reported_user) then raise exception 'reported user is not in room'; end if;
 insert into public.user_reports(reporter_id,reported_user_id,room_id,reason,details) values(me,_reported_user, _room_id,coalesce(nullif(trim(_reason),''),'Room moderation report'),_details) returning id into rid;
 return rid;
end $$;
grant execute on function public.report_room_user_to_host(uuid,uuid,text,text) to authenticated;

create or replace function public.toggle_seat_lock(_room_id uuid,_seat_index int,_locked boolean)
returns int[] language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); r_host uuid; cur int[]; mod_ok boolean;
begin
 if me is null then raise exception 'not authenticated'; end if;
 select host_id,coalesce(locked_seats,'{}'::int[]),coalesce(moderator_can_manage_seats,false) into r_host,cur,mod_ok from public.live_rooms where id=_room_id;
 if r_host is null then raise exception 'room not found'; end if;
 if me<>r_host and not (mod_ok and exists(select 1 from public.room_members where room_id=_room_id and user_id=me and is_moderator)) then raise exception 'seat moderation is not enabled for this moderator'; end if;
 if _seat_index=0 then raise exception 'host seat cannot be locked by moderator'; end if;
 if _locked and not (_seat_index=any(cur)) then cur:=array_append(cur,_seat_index); elsif not _locked then cur:=array_remove(cur,_seat_index); end if;
 update public.live_rooms set locked_seats=cur where id=_room_id; return cur;
end $$;
grant execute on function public.toggle_seat_lock(uuid,int,boolean) to authenticated;

do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='room_members') then execute 'alter publication supabase_realtime add table public.room_members'; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='live_rooms') then execute 'alter publication supabase_realtime add table public.live_rooms'; end if;
 execute 'alter table public.room_members replica identity full';
 execute 'alter table public.live_rooms replica identity full';
end $$;