-- Promote an explicitly marked normal user into a Super Agent's child slot safely.
create or replace function public.upgrade_normal_user_role_for_super_child()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.role='coin_agent' and new.parent_agent_id is not null
   and exists(select 1 from public.coin_agent_roles existing where existing.user_id=new.user_id and existing.role='normal_user') then
   update public.coin_agent_roles set role='coin_agent',parent_agent_id=new.parent_agent_id,
     assigned_by=new.assigned_by,updated_at=now() where user_id=new.user_id and role='normal_user';
   return null;
 end if;
 return new;
end; $$;
drop trigger if exists upgrade_normal_user_role_for_super_child_trigger on public.coin_agent_roles;
create trigger upgrade_normal_user_role_for_super_child_trigger
before insert on public.coin_agent_roles for each row
execute function public.upgrade_normal_user_role_for_super_child();
revoke all on function public.upgrade_normal_user_role_for_super_child() from public,anon,authenticated;
