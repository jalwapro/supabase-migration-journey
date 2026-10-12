create or replace function public.coin_agent_role_access(actor_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_role text; v_parent uuid; v_allowed boolean;
begin
 if actor_id is null or not exists(select 1 from auth.users where id=actor_id) then raise exception 'AUTH_REQUIRED'; end if;
 select role,parent_agent_id into v_role,v_parent from public.coin_agent_roles where user_id=actor_id;
 select coalesce(v_role,'normal_user') in ('coin_agent','super_coin_agent')
   and exists(select 1 from public.coin_sellers cs join public.agent_profiles ap on ap.user_id=cs.user_id
     where cs.user_id=actor_id and cs.is_active and ap.is_active and ap.coin_agent_enabled and not ap.is_banned)
 into v_allowed;
 return jsonb_build_object('allowed',coalesce(v_allowed,false),'role',coalesce(v_role,'normal_user'),'parent_agent_id',v_parent);
end; $$;
revoke all on function public.coin_agent_role_access(uuid) from public,anon,authenticated;
grant execute on function public.coin_agent_role_access(uuid) to service_role;
