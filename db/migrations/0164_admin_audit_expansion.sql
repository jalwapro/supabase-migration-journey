-- C10: Admin audit expansion
-- - Central log_admin_action() RPC (SECURITY DEFINER, admin-gated).
-- - Auto-log triggers on user_roles, withdrawal_requests, recharge_requests.
-- - Performance indexes on admin_logs.

-- ---------- helper RPC ----------
create or replace function public.log_admin_action(
  _action text,
  _target text default null,
  _details jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
  _actor uuid := auth.uid();
  _trusted boolean := coalesce(current_setting('app.trusted_definer', true) = 'on', false);
begin
  if _actor is null and not _trusted then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if _actor is not null and not is_admin(_actor) and not _trusted then
    raise exception 'admin only' using errcode = '42501';
  end if;

  insert into public.admin_logs(admin_id, action, target, details)
  values (_actor, _action, _target, _details)
  returning id into _id;

  return _id;
end
$$;

revoke all on function public.log_admin_action(text, text, jsonb) from public;
grant execute on function public.log_admin_action(text, text, jsonb) to authenticated;

-- ---------- user_roles audit trigger ----------
create or replace function public.trg_user_roles_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare _actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into public.admin_logs(admin_id, action, target, details)
    values (_actor, 'role.grant', new.user_id::text,
            jsonb_build_object('role', new.role, 'row_id', new.id));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.admin_logs(admin_id, action, target, details)
    values (_actor, 'role.revoke', old.user_id::text,
            jsonb_build_object('role', old.role, 'row_id', old.id));
    return old;
  end if;
  return null;
end
$$;

drop trigger if exists trg_user_roles_audit on public.user_roles;
create trigger trg_user_roles_audit
  after insert or delete on public.user_roles
  for each row execute function public.trg_user_roles_audit();

-- ---------- withdrawal_requests audit trigger ----------
create or replace function public.trg_withdrawal_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare _actor uuid := auth.uid();
begin
  if new.status is distinct from old.status then
    insert into public.admin_logs(admin_id, action, target, details)
    values (
      _actor,
      'withdrawal.' || new.status::text,
      new.id::text,
      jsonb_build_object(
        'user_id', new.user_id,
        'diamonds', new.diamonds,
        'amount_pkr', new.amount_pkr,
        'method', new.method,
        'admin_note', new.admin_note,
        'prev_status', old.status
      )
    );
  end if;
  return new;
end
$$;

drop trigger if exists trg_withdrawal_audit on public.withdrawal_requests;
create trigger trg_withdrawal_audit
  after update on public.withdrawal_requests
  for each row execute function public.trg_withdrawal_audit();

-- ---------- recharge_requests audit trigger ----------
create or replace function public.trg_recharge_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare _actor uuid := auth.uid();
begin
  if new.status is distinct from old.status then
    insert into public.admin_logs(admin_id, action, target, details)
    values (
      _actor,
      'recharge.' || new.status::text,
      new.id::text,
      jsonb_build_object(
        'user_id', new.user_id,
        'coins', new.coins,
        'amount_pkr', coalesce(new.amount_pkr, new.amount_paid),
        'method', new.method,
        'admin_note', new.admin_note,
        'prev_status', old.status
      )
    );
  end if;
  return new;
end
$$;

drop trigger if exists trg_recharge_audit on public.recharge_requests;
create trigger trg_recharge_audit
  after update on public.recharge_requests
  for each row execute function public.trg_recharge_audit();

-- ---------- performance indexes ----------
create index if not exists idx_admin_logs_created_at
  on public.admin_logs (created_at desc);
create index if not exists idx_admin_logs_action_created_at
  on public.admin_logs (action, created_at desc);
create index if not exists idx_admin_logs_admin_created_at
  on public.admin_logs (admin_id, created_at desc);
