-- Finish the new Master-Agency front-end workflows: Super Agents can create
-- and manage up to five child Sub-Agents, without access to legacy agent tables.
begin;

create policy p2p_super_agent_read_children on public.p2p_profiles
for select to authenticated
using (
  role='sub_agent'
  and super_agent_id=(select auth.uid())
  and (select p2p_private.current_role())='super_agent'
);

create or replace function public.p2p_super_create_sub_agent(
  p_user_id uuid,
  p_display_name text default null
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_existing public.p2p_profiles%rowtype;
  v_count integer;
begin
  if v_actor is null or p_user_id is null or p_user_id=v_actor then
    raise exception 'INVALID_SUB_AGENT';
  end if;

  -- Serialize child creation per Super Agent so concurrent requests cannot exceed five.
  perform 1 from public.p2p_profiles
   where user_id=v_actor and role='super_agent' and active
   for update;
  if not found then raise exception 'ACTIVE_SUPER_AGENT_REQUIRED'; end if;

  select count(*) into v_count from public.p2p_profiles
   where super_agent_id=v_actor and role='sub_agent';
  if v_count>=5 then raise exception 'SUB_AGENT_LIMIT_REACHED'; end if;

  select * into v_existing from public.p2p_profiles where user_id=p_user_id for update;
  if found then
    if v_existing.role='admin' or v_existing.role='super_agent' then
      raise exception 'USER_ALREADY_HAS_PRIVILEGED_ROLE';
    end if;
    if v_existing.role='sub_agent' and v_existing.super_agent_id<>v_actor then
      raise exception 'USER_ALREADY_ASSIGNED_TO_ANOTHER_SUPER_AGENT';
    end if;
    update public.p2p_profiles set
      role='sub_agent',
      super_agent_id=v_actor,
      display_name=coalesce(nullif(trim(p_display_name),''),display_name),
      active=true,
      updated_at=now()
    where user_id=p_user_id;
  else
    insert into public.p2p_profiles(user_id,role,super_agent_id,display_name)
    values(p_user_id,'sub_agent',v_actor,nullif(trim(p_display_name),''));
  end if;
end $$;

revoke all on function public.p2p_super_create_sub_agent(uuid,text) from public,anon;
grant execute on function public.p2p_super_create_sub_agent(uuid,text) to authenticated;

create or replace function public.p2p_super_set_sub_agent_active(
  p_user_id uuid,
  p_active boolean
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or p_active is null then raise exception 'INVALID_REQUEST'; end if;
  perform 1 from public.p2p_profiles
   where user_id=v_actor and role='super_agent' and active
   for update;
  if not found then raise exception 'ACTIVE_SUPER_AGENT_REQUIRED'; end if;
  update public.p2p_profiles
   set active=p_active,updated_at=now()
   where user_id=p_user_id and role='sub_agent' and super_agent_id=v_actor;
  if not found then raise exception 'SUB_AGENT_NOT_IN_YOUR_AGENCY'; end if;
end $$;

revoke all on function public.p2p_super_set_sub_agent_active(uuid,boolean) from public,anon;
grant execute on function public.p2p_super_set_sub_agent_active(uuid,boolean) to authenticated;

commit;
