CREATE OR REPLACE FUNCTION public.admin_delete_room(_room_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  active_pk uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not public.is_admin(me) then raise exception 'admins only'; end if;

  select active_pk_match_id into active_pk
    from public.live_rooms where id = _room_id;

  if active_pk is not null then
    begin
      perform public.pk_end_match(active_pk);
    exception when others then
      raise notice 'pk_end_match failed for %: %', active_pk, sqlerrm;
    end;
  end if;

  begin
    perform public.finalize_room_gifts(_room_id);
  exception when others then
    raise notice 'finalize_room_gifts failed for %: %', _room_id, sqlerrm;
  end;

  delete from public.live_rooms where id = _room_id;

  insert into public.admin_logs(admin_id, action, target)
    values (me, 'delete_room', _room_id::text);
end $function$
;
CREATE OR REPLACE FUNCTION public.claim_support_conversation(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not public.is_support_agent(me) then raise exception 'agents only'; end if;

  update public.support_conversations
     set assigned_agent = me, unread_for_agent = 0
   where id = _id;
  if not found then raise exception 'conversation not found'; end if;

  insert into public.admin_logs(admin_id, action, target)
    values (me, 'support_claim', _id::text);
end $function$
;
CREATE OR REPLACE FUNCTION public.close_support_conversation(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  cust uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not public.is_support_agent(me) then raise exception 'agents only'; end if;

  update public.support_conversations
     set status = 'closed'
   where id = _id
   returning user_id into cust;
  if cust is null then raise exception 'conversation not found'; end if;

  insert into public.admin_logs(admin_id, action, target)
    values (me, 'support_close', _id::text);

  begin
    insert into public.notifications (user_id, kind, title, body, data)
      values (cust, 'support_update', 'Support ticket closed',
              'Your support conversation has been closed. Reopen anytime from Help.',
              jsonb_build_object('conversation_id', _id));
  exception when others then
    raise notice 'notify failed: %', sqlerrm;
  end;
end $function$
;
CREATE OR REPLACE FUNCTION public.set_report_status(_id uuid, _status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  r record;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not public.is_admin(me) then raise exception 'admins only'; end if;
  if _status not in ('resolved','dismissed','pending') then
    raise exception 'invalid status';
  end if;

  update public.user_reports set status = _status where id = _id
    returning * into r;
  if not found then raise exception 'report not found'; end if;

  insert into public.admin_logs(admin_id, action, target)
    values (me, 'report_' || _status, _id::text);

  if _status in ('resolved','dismissed') and r.reporter_id is not null then
    begin
      insert into public.notifications (user_id, kind, title, body, data)
        values (
          r.reporter_id,
          'report_update',
          case when _status = 'resolved' then 'Report reviewed' else 'Report closed' end,
          case when _status = 'resolved'
               then 'Thanks — we took action on your report.'
               else 'We reviewed your report and no action was needed.' end,
          jsonb_build_object('report_id', _id)
        );
    exception when others then
      raise notice 'notify failed: %', sqlerrm;
    end;
  end if;
end $function$
;
