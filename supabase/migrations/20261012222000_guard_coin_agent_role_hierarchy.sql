-- Protect parent/child role invariants for Coin Agents.
create or replace function public.guard_coin_agent_role_hierarchy()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' and old.role='super_coin_agent' and new.role<>'super_coin_agent'
   and exists(select 1 from public.coin_agent_roles child where child.parent_agent_id=old.user_id) then
   raise exception 'SUPER_AGENT_HAS_CHILDREN_REASSIGN_FIRST';
 end if;
 if new.role='super_coin_agent' then new.parent_agent_id:=null; end if;
 if new.parent_agent_id is not null then
   if new.role<>'coin_agent' then raise exception 'ONLY_COIN_AGENTS_CAN_HAVE_A_PARENT'; end if;
   if not exists(select 1 from public.coin_agent_roles parent
     join public.agent_profiles ap on ap.user_id=parent.user_id
     join public.coin_sellers cs on cs.user_id=parent.user_id
     where parent.user_id=new.parent_agent_id and parent.role='super_coin_agent'
       and ap.is_active and ap.coin_agent_enabled and not ap.is_banned and cs.is_active) then
     raise exception 'PARENT_MUST_BE_ACTIVE_SUPER_COIN_AGENT';
   end if;
 end if;
 return new;
end; $$;
drop trigger if exists guard_coin_agent_role_hierarchy_trigger on public.coin_agent_roles;
create trigger guard_coin_agent_role_hierarchy_trigger
before insert or update of role,parent_agent_id on public.coin_agent_roles
for each row execute function public.guard_coin_agent_role_hierarchy();
revoke all on function public.guard_coin_agent_role_hierarchy() from public,anon,authenticated;
