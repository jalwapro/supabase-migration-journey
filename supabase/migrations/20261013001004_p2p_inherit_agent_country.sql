-- A Super Agent's Sub-Agents inherit the Admin-assigned country/currency.
-- Assignment remains capped at five and new agents are not listed until configured.
begin;

create or replace function public.p2p_super_create_sub_agent(p_user_id uuid,p_display_name text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_parent public.p2p_agent_settings%rowtype;
  v_existing public.p2p_profiles%rowtype;
  v_count integer;
begin
  if v_actor is null or p_user_id is null or p_user_id=v_actor then raise exception 'INVALID_SUB_AGENT'; end if;
  perform 1 from public.p2p_profiles where user_id=v_actor and role='super_agent' and active for update;
  if not found then raise exception 'ACTIVE_SUPER_AGENT_REQUIRED'; end if;
  select * into v_parent from public.p2p_agent_settings where agent_id=v_actor;
  if not found then raise exception 'SUPER_AGENT_COUNTRY_NOT_CONFIGURED'; end if;
  select count(*) into v_count from public.p2p_profiles where super_agent_id=v_actor and role='sub_agent';
  if v_count>=5 then raise exception 'SUB_AGENT_LIMIT_REACHED'; end if;
  select * into v_existing from public.p2p_profiles where user_id=p_user_id for update;
  if found then
    if v_existing.role in ('admin','super_agent') then raise exception 'USER_ALREADY_HAS_PRIVILEGED_ROLE'; end if;
    if v_existing.role='sub_agent' and v_existing.super_agent_id<>v_actor then raise exception 'USER_ALREADY_ASSIGNED_TO_ANOTHER_SUPER_AGENT'; end if;
    update public.p2p_profiles set role='sub_agent',super_agent_id=v_actor,
      display_name=coalesce(nullif(trim(p_display_name),''),display_name),active=true,updated_at=now()
      where user_id=p_user_id;
  else
    insert into public.p2p_profiles(user_id,role,super_agent_id,display_name)
    values(p_user_id,'sub_agent',v_actor,nullif(trim(p_display_name),''));
  end if;
  insert into public.p2p_agent_settings(agent_id,country_code,currency_code,coins_per_bundle,payment_methods,payment_details,min_order_coins,max_order_coins,is_listed)
  values(p_user_id,v_parent.country_code,v_parent.currency_code,v_parent.coins_per_bundle,array['JazzCash']::text[],'{}'::jsonb,500,100000,false)
  on conflict(agent_id) do update set country_code=excluded.country_code,currency_code=excluded.currency_code,
    is_listed=false,updated_at=now();
end $$;
revoke all on function public.p2p_super_create_sub_agent(uuid,text) from public,anon;
grant execute on function public.p2p_super_create_sub_agent(uuid,text) to authenticated;

-- Keep the alternate historical RPC name safe and behaviorally identical.
create or replace function public.p2p_super_agent_create_sub_agent(p_user_id uuid,p_display_name text default null)
returns void language plpgsql security definer set search_path=''
as $$
begin
  perform public.p2p_super_create_sub_agent(p_user_id,p_display_name);
end $$;
revoke all on function public.p2p_super_agent_create_sub_agent(uuid,text) from public,anon;
grant execute on function public.p2p_super_agent_create_sub_agent(uuid,text) to authenticated;

commit;
