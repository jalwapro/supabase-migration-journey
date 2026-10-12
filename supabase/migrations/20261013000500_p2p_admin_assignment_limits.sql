-- Keep Admin assignment subject to the same five-Sub-Agent agency limit.
begin;
create or replace function public.p2p_admin_assign_role(
  p_user_id uuid,p_role public.p2p_role,p_super_agent_id uuid default null,p_display_name text default null
) returns void language plpgsql security definer set search_path=''
as $$
declare
  v_old public.p2p_profiles%rowtype;
  v_count integer;
  v_had_old boolean:=false;
begin
  if (select p2p_private.current_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_role='admin' then raise exception 'ADMIN_ROLE_MUST_BE_BOOTSTRAPPED_OUT_OF_BAND'; end if;
  select * into v_old from public.p2p_profiles where user_id=p_user_id for update;
  v_had_old:=found;
  if v_had_old and v_old.role='admin' then raise exception 'ADMIN_ROLE_MUST_BE_MANAGED_OUT_OF_BAND'; end if;
  if p_role='sub_agent' then
    if p_super_agent_id is null or p_super_agent_id=p_user_id
      or not exists(select 1 from public.p2p_profiles where user_id=p_super_agent_id and role='super_agent' and active) then
      raise exception 'ACTIVE_SUPER_AGENT_REQUIRED';
    end if;
    perform 1 from public.p2p_profiles where user_id=p_super_agent_id and role='super_agent' and active for update;
    if not found then raise exception 'ACTIVE_SUPER_AGENT_REQUIRED'; end if;
    select count(*) into v_count from public.p2p_profiles
      where super_agent_id=p_super_agent_id and role='sub_agent' and user_id<>p_user_id;
    if v_count>=5 then raise exception 'SUB_AGENT_LIMIT_REACHED'; end if;
  elsif p_super_agent_id is not null then
    raise exception 'ONLY_SUB_AGENT_HAS_PARENT';
  end if;
  if v_had_old and v_old.role='super_agent' and p_role<>'super_agent'
    and exists(select 1 from public.p2p_profiles where super_agent_id=p_user_id and role='sub_agent') then
    raise exception 'REASSIGN_OR_DEACTIVATE_SUBAGENTS_FIRST';
  end if;
  insert into public.p2p_profiles(user_id,role,super_agent_id,display_name)
  values(p_user_id,p_role,p_super_agent_id,nullif(trim(p_display_name),''))
  on conflict(user_id) do update set role=excluded.role,super_agent_id=excluded.super_agent_id,
    display_name=coalesce(excluded.display_name,public.p2p_profiles.display_name),updated_at=now();
end $$;
revoke all on function public.p2p_admin_assign_role(uuid,public.p2p_role,uuid,text) from public,anon;
grant execute on function public.p2p_admin_assign_role(uuid,public.p2p_role,uuid,text) to authenticated;
commit;
