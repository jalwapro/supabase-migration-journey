-- Account deletion for the authenticated user.
-- Financial/audit records are intentionally retained where legally or operationally
-- necessary; the privacy policy discloses those retention exceptions.

create schema if not exists private;

create or replace function private.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_table text;
  v_predicate text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  delete from storage.objects where owner_id = v_uid::text;

  for v_table in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name in ('user_id','owner_id','follower_id','following_id','sender_id','receiver_id','host_id','actor_id','target_id')
      and c.table_name not in ('wallet_transactions','recharge_orders','recharge_requests','withdrawal_requests','card_recharge_orders','admin_logs','vip_admin_logs')
    group by c.table_name
  loop
    select string_agg(format('%I = $1', c.column_name), ' or ' order by c.ordinal_position)
      into v_predicate
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = v_table
      and c.column_name in ('user_id','owner_id','follower_id','following_id','sender_id','receiver_id','host_id','actor_id','target_id');

    if v_predicate is not null then
      execute format('delete from public.%I where %s', v_table, v_predicate) using v_uid;
    end if;
  end loop;

  delete from public.profiles where id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function private.delete_my_account() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.delete_my_account() to authenticated;

create or replace function public.delete_my_account()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated'; end if;
  perform private.delete_my_account();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

