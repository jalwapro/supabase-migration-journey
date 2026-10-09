-- Shared, persistent admin alerts. Each admin gets their own inbox row so read state is per-admin.
create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  target_path text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists admin_notifications_recipient_created_idx
  on public.admin_notifications (recipient_id, created_at desc);
create index if not exists admin_notifications_unread_idx
  on public.admin_notifications (recipient_id, created_at desc) where read_at is null;

alter table public.admin_notifications enable row level security;
revoke all on public.admin_notifications from anon;
grant select on public.admin_notifications to authenticated;
revoke update on public.admin_notifications from authenticated;
grant update (read_at) on public.admin_notifications to authenticated;

drop policy if exists "Admins can read own admin notifications" on public.admin_notifications;
create policy "Admins can read own admin notifications"
  on public.admin_notifications for select to authenticated
  using (
    recipient_id = auth.uid()
    and (
      exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('admin', 'super_admin'))
      or lower(coalesce(auth.jwt() ->> 'email', '')) = 'jalwaapplive@gmail.com'
    )
  );

drop policy if exists "Admins can mark own admin notifications read" on public.admin_notifications;
create policy "Admins can mark own admin notifications read"
  on public.admin_notifications for update to authenticated
  using (
    recipient_id = auth.uid()
    and (
      exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('admin', 'super_admin'))
      or lower(coalesce(auth.jwt() ->> 'email', '')) = 'jalwaapplive@gmail.com'
    )
  )
  with check (
    recipient_id = auth.uid()
    and (
      exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('admin', 'super_admin'))
      or lower(coalesce(auth.jwt() ->> 'email', '')) = 'jalwaapplive@gmail.com'
    )
  );

create or replace function public.notify_all_admins_of_activity()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  row_data jsonb := to_jsonb(new);
  actor_id text;
  record_id uuid;
  notif_kind text;
  notif_title text;
  notif_body text;
  target text;
begin
  actor_id := coalesce(row_data ->> 'user_id', row_data ->> 'reporter_id', row_data ->> 'created_by', row_data ->> 'sender_id');
  record_id := case when coalesce(row_data ->> 'id', '') ~* '^[0-9a-f-]{36}$' then (row_data ->> 'id')::uuid else null end;

  if tg_table_name = 'recharge_requests' then
    notif_kind := 'recharge_pending';
    notif_title := 'New recharge request';
    notif_body := 'A recharge request needs admin review' ||
      case when coalesce(row_data ->> 'amount_pkr', '') <> '' then ' · PKR ' || (row_data ->> 'amount_pkr') else '' end;
    target := '/admin/recharge';
  elsif tg_table_name = 'withdrawal_requests' then
    notif_kind := 'withdrawal_pending';
    notif_title := 'New withdrawal request';
    notif_body := 'A withdrawal request needs admin review' ||
      case when coalesce(row_data ->> 'amount', row_data ->> 'amount_pkr', '') <> '' then ' · Amount ' || coalesce(row_data ->> 'amount', row_data ->> 'amount_pkr') else '' end;
    target := '/admin/withdrawals';
  elsif tg_table_name = 'user_reports' then
    notif_kind := 'user_report';
    notif_title := 'New user report';
    notif_body := left(coalesce(nullif(row_data ->> 'reason', ''), nullif(row_data ->> 'details', ''), 'A user report needs review'), 180);
    target := '/admin/reports';
  elsif tg_table_name = 'user_ban_appeals' then
    notif_kind := 'ban_appeal';
    notif_title := 'New ban appeal';
    notif_body := 'An account ban appeal needs review';
    target := '/admin/users';
  else
    return new;
  end if;

  insert into public.admin_notifications (recipient_id, kind, title, body, target_path, entity_id)
  select distinct admins.id, notif_kind, notif_title, notif_body, target, record_id
  from (
    select ur.user_id as id
    from public.user_roles ur
    where ur.role in ('admin', 'super_admin')
    union
    select au.id
    from auth.users au
    where lower(coalesce(au.email, '')) = 'jalwaapplive@gmail.com'
  ) admins
  where admins.id is not null;

  return new;
end;
$$;

revoke all on function public.notify_all_admins_of_activity() from public, anon, authenticated;

drop trigger if exists admin_notify_recharge_insert on public.recharge_requests;
create trigger admin_notify_recharge_insert
  after insert on public.recharge_requests
  for each row execute function public.notify_all_admins_of_activity();

drop trigger if exists admin_notify_withdrawal_insert on public.withdrawal_requests;
create trigger admin_notify_withdrawal_insert
  after insert on public.withdrawal_requests
  for each row execute function public.notify_all_admins_of_activity();

drop trigger if exists admin_notify_user_report_insert on public.user_reports;
create trigger admin_notify_user_report_insert
  after insert on public.user_reports
  for each row execute function public.notify_all_admins_of_activity();

drop trigger if exists admin_notify_ban_appeal_insert on public.user_ban_appeals;
create trigger admin_notify_ban_appeal_insert
  after insert on public.user_ban_appeals
  for each row execute function public.notify_all_admins_of_activity();

do $$
begin
  alter publication supabase_realtime add table public.admin_notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
