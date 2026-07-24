-- ============================================================================
-- 0170 — Area 4: Support Chat + Reports + Custom Themes + Banners/Ads
-- Findings addressed: C1/C2/C3 (report flow), H1 (realtime), H3 (custom theme
-- PII leak), H4 (support conv audit), M1 (report notifications),
-- M2 (report grant narrowing), M5 (link_url validation), L2 (reason cap).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- C3 + L2: submit_user_report RPC with rate-limit + validation.
-- ---------------------------------------------------------------------------
create or replace function public.submit_user_report(
  _reported_user uuid,
  _room_id uuid,
  _reason text,
  _details text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if _reported_user is null and _room_id is null then
    raise exception 'must specify user or room';
  end if;
  if _reported_user = me then
    raise exception 'cannot report yourself';
  end if;
  if _reason is null or length(trim(_reason)) < 3 then
    raise exception 'reason required';
  end if;
  if length(_reason) > 120 then
    raise exception 'reason too long';
  end if;
  if _details is not null and length(_details) > 800 then
    raise exception 'details too long';
  end if;

  -- Rate limit: no duplicate pending report for same target in last 10 min.
  if exists (
    select 1 from public.user_reports
     where reporter_id = me
       and coalesce(reported_user_id::text,'') = coalesce(_reported_user::text,'')
       and coalesce(room_id::text,'') = coalesce(_room_id::text,'')
       and status = 'pending'
       and created_at > now() - interval '10 minutes'
  ) then
    raise exception 'duplicate report — please wait';
  end if;

  -- Overall throttle: max 20 reports/hour per user.
  if (
    select count(*) from public.user_reports
     where reporter_id = me and created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'too many reports — try again later';
  end if;

  insert into public.user_reports (reporter_id, reported_user_id, room_id, reason, details, status)
    values (me, _reported_user, _room_id, trim(_reason), nullif(trim(coalesce(_details,'')),''), 'pending')
    returning id into new_id;

  return new_id;
end $$;

grant execute on function public.submit_user_report(uuid, uuid, text, text) to authenticated;

-- Narrow direct table grants (M2): keep SELECT for own-report visibility;
-- INSERT/UPDATE/DELETE go through admin/RPC paths.
revoke insert, update, delete on public.user_reports from authenticated;
-- Keep SELECT so own-reports RLS policy still works.

-- ---------------------------------------------------------------------------
-- M1: set_report_status RPC — updates + admin_logs + notifies reporter.
-- ---------------------------------------------------------------------------
create or replace function public.set_report_status(_id uuid, _status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  insert into public.admin_logs(actor, action, target)
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
end $$;

grant execute on function public.set_report_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- H4: support conversation claim + close via RPC with audit log.
-- ---------------------------------------------------------------------------
create or replace function public.claim_support_conversation(_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not public.is_support_agent(me) then raise exception 'agents only'; end if;

  update public.support_conversations
     set assigned_agent = me, unread_for_agent = 0
   where id = _id;
  if not found then raise exception 'conversation not found'; end if;

  insert into public.admin_logs(actor, action, target)
    values (me, 'support_claim', _id::text);
end $$;

grant execute on function public.claim_support_conversation(uuid) to authenticated;

create or replace function public.close_support_conversation(_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  insert into public.admin_logs(actor, action, target)
    values (me, 'support_close', _id::text);

  begin
    insert into public.notifications (user_id, kind, title, body, data)
      values (cust, 'support_update', 'Support ticket closed',
              'Your support conversation has been closed. Reopen anytime from Help.',
              jsonb_build_object('conversation_id', _id));
  exception when others then
    raise notice 'notify failed: %', sqlerrm;
  end;
end $$;

grant execute on function public.close_support_conversation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- H3: get_active_custom_theme — narrow return shape (no PII to anon).
-- ---------------------------------------------------------------------------
drop function if exists public.get_active_custom_theme(uuid);
create or replace function public.get_active_custom_theme(_user uuid)
returns table(image_url text, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select image_url, expires_at
    from public.custom_themes
   where user_id = _user
     and status = 'approved'
     and (expires_at is null or expires_at > now())
   order by approved_at desc nulls last
   limit 1
$$;

grant execute on function public.get_active_custom_theme(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- H1: realtime + replica identity for admin dashboards.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_reports'
  ) then
    execute 'alter publication supabase_realtime add table public.user_reports';
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'custom_themes'
  ) then
    execute 'alter publication supabase_realtime add table public.custom_themes';
  end if;
end $$;

alter table public.user_reports replica identity full;
alter table public.custom_themes replica identity full;

-- ---------------------------------------------------------------------------
-- M5: link_url protocol validation on banners + ads.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.banners') is not null and not exists (
    select 1 from pg_constraint where conname = 'banners_link_url_scheme_chk'
  ) then
    alter table public.banners
      add constraint banners_link_url_scheme_chk
      check (link_url is null or link_url ~ '^(https?://|/)');
  end if;
  if to_regclass('public.ads') is not null and not exists (
    select 1 from pg_constraint where conname = 'ads_link_url_scheme_chk'
  ) then
    alter table public.ads
      add constraint ads_link_url_scheme_chk
      check (link_url is null or link_url ~ '^(https?://|/)');
  end if;
end $$;

notify pgrst, 'reload schema';
