-- Coin Agent RBAC + Super Coin Agent hierarchy. Existing balances/trades/withdrawals are preserved.
create table if not exists public.coin_agent_roles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'normal_user' check(role in ('normal_user','coin_agent','super_coin_agent')),
 parent_agent_id uuid references public.coin_agent_roles(user_id) on delete set null,
 assigned_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint coin_agent_role_not_own_parent check(parent_agent_id is null or parent_agent_id<>user_id)
);
create index if not exists coin_agent_roles_parent_idx on public.coin_agent_roles(parent_agent_id);
create index if not exists coin_agent_roles_role_idx on public.coin_agent_roles(role);
alter table public.coin_agent_roles enable row level security;
revoke all on public.coin_agent_roles from public,anon,authenticated;
grant select,insert,update,delete on public.coin_agent_roles to service_role;

create table if not exists public.coin_agent_role_audit (
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id) on delete set null,
 target_id uuid not null references auth.users(id) on delete restrict,
 old_role text,new_role text not null,old_parent_agent_id uuid,new_parent_agent_id uuid,
 action text not null,details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);
create index if not exists coin_agent_role_audit_target_idx on public.coin_agent_role_audit(target_id,created_at desc);
alter table public.coin_agent_role_audit enable row level security;
revoke all on public.coin_agent_role_audit from public,anon,authenticated;
grant select,insert on public.coin_agent_role_audit to service_role;

insert into public.coin_agent_roles(user_id,role)
select cs.user_id,'coin_agent' from public.coin_sellers cs join public.agent_profiles ap on ap.user_id=cs.user_id
where cs.is_active and ap.is_active and ap.coin_agent_enabled and not ap.is_banned on conflict(user_id) do nothing;

create or replace function public.coin_agent_role_action(actor_id uuid,action text,payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_target uuid; v_role text; v_old_role text; v_old_parent uuid; v_country text; v_currency text;
 v_whatsapp text; v_public_name text; v_public_note text; v_count integer; v_agent public.agent_profiles%rowtype;
begin
 if actor_id is null or not exists(select 1 from auth.users where id=actor_id) then raise exception 'AUTH_REQUIRED'; end if;
 if action='ADMIN_LIST_ROLES' then
  if not public.is_admin(actor_id) then raise exception 'ADMIN_REQUIRED'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
   'user_id',r.user_id,'role',r.role,'parent_agent_id',r.parent_agent_id,'assigned_by',r.assigned_by,
   'created_at',r.created_at,'updated_at',r.updated_at,'username',p.username,'user_code',p.user_code,
   'country',coalesce(cs.country,ap.country),
   'is_active',coalesce(cs.is_active,false) and coalesce(ap.is_active,false) and coalesce(ap.coin_agent_enabled,false) and not coalesce(ap.is_banned,false),
   'available_coins',coalesce(inv.available_coins,0),'total_allocated',coalesce(inv.total_allocated,0),'total_sold',coalesce(inv.total_sold,0),
   'child_count',(select count(*) from public.coin_agent_roles c where c.parent_agent_id=r.user_id)
  ) order by r.updated_at desc) from public.coin_agent_roles r join public.profiles p on p.id=r.user_id
  left join public.coin_sellers cs on cs.user_id=r.user_id left join public.agent_profiles ap on ap.user_id=r.user_id
  left join public.coin_seller_inventory inv on inv.seller_id=r.user_id),'[]'::jsonb);
 elsif action='ADMIN_SET_ROLE' then
  if not public.is_admin(actor_id) then raise exception 'ADMIN_REQUIRED'; end if;
  v_target:=nullif(payload->>'target_id','')::uuid; v_role:=trim(coalesce(payload->>'role',''));
  if v_target is null or not exists(select 1 from auth.users where id=v_target) then raise exception 'USER_NOT_FOUND'; end if;
  if v_role not in ('normal_user','coin_agent','super_coin_agent') then raise exception 'INVALID_COIN_AGENT_ROLE'; end if;
  if v_target=actor_id and v_role<>'super_coin_agent' then raise exception 'CANNOT_REMOVE_OWN_ADMIN_ROLE'; end if;
  select role,parent_agent_id into v_old_role,v_old_parent from public.coin_agent_roles where user_id=v_target;
  if v_role in ('coin_agent','super_coin_agent') then
   if not exists(select 1 from public.coin_sellers where user_id=v_target and is_active) then raise exception 'ASSIGN_ACTIVE_COIN_SELLER_FIRST'; end if;
   if not exists(select 1 from public.agent_profiles where user_id=v_target and is_active and coin_agent_enabled and not is_banned) then raise exception 'ENABLE_ACTIVE_COIN_AGENT_FIRST'; end if;
  end if;
  if v_role='normal_user' then
   update public.coin_sellers set is_active=false,is_listed=false,updated_at=now() where user_id=v_target;
   update public.agent_profiles set is_active=false,coin_agent_enabled=false,updated_at=now() where user_id=v_target;
   update public.coin_agent_roles set role='normal_user',parent_agent_id=null,assigned_by=actor_id,updated_at=now() where user_id=v_target;
   if not found then insert into public.coin_agent_roles(user_id,role,assigned_by) values(v_target,'normal_user',actor_id); end if;
  else
   insert into public.coin_agent_roles(user_id,role,parent_agent_id,assigned_by,updated_at) values(v_target,v_role,null,actor_id,now())
   on conflict(user_id) do update set role=excluded.role,parent_agent_id=null,assigned_by=excluded.assigned_by,updated_at=now();
  end if;
  insert into public.coin_agent_role_audit(actor_id,target_id,old_role,new_role,old_parent_agent_id,new_parent_agent_id,action,details)
  values(actor_id,v_target,coalesce(v_old_role,'normal_user'),v_role,v_old_parent,null,'admin_role_assignment',
   jsonb_build_object('preserved_wallet_balances',true,'preserved_transaction_history',true));
  return jsonb_build_object('success',true,'user_id',v_target,'role',v_role,'previous_role',coalesce(v_old_role,'normal_user'));
 elsif action in ('ROLE_CONTEXT','SUPER_LIST_CHILDREN') then
  select role into v_role from public.coin_agent_roles where user_id=actor_id;
  if coalesce(v_role,'normal_user')<>'super_coin_agent' or not exists(
   select 1 from public.agent_profiles ap join public.coin_sellers cs on cs.user_id=ap.user_id
   where ap.user_id=actor_id and ap.is_active and ap.coin_agent_enabled and not ap.is_banned and cs.is_active
  ) then raise exception 'ACTIVE_SUPER_COIN_AGENT_REQUIRED'; end if;
  return jsonb_build_object('role',v_role,'max_children',5,
   'children',coalesce((select jsonb_agg(jsonb_build_object('user_id',c.user_id,'role',c.role,'username',p.username,'user_code',p.user_code,
    'country',cs.country,'is_active',cs.is_active and ap.is_active and ap.coin_agent_enabled and not ap.is_banned,
    'available_coins',coalesce(inv.available_coins,0),'total_sold',coalesce(inv.total_sold,0),'created_at',c.created_at) order by c.created_at desc)
    from public.coin_agent_roles c join public.profiles p on p.id=c.user_id left join public.coin_sellers cs on cs.user_id=c.user_id
    left join public.agent_profiles ap on ap.user_id=c.user_id left join public.coin_seller_inventory inv on inv.seller_id=c.user_id
    where c.parent_agent_id=actor_id),'[]'::jsonb),
   'child_count',(select count(*) from public.coin_agent_roles where parent_agent_id=actor_id));
 elsif action='SUPER_CREATE_CHILD_AGENT' then
  select role into v_role from public.coin_agent_roles where user_id=actor_id;
  if coalesce(v_role,'normal_user')<>'super_coin_agent' or not exists(
   select 1 from public.agent_profiles ap join public.coin_sellers cs on cs.user_id=ap.user_id
   where ap.user_id=actor_id and ap.is_active and ap.coin_agent_enabled and not ap.is_banned and cs.is_active
  ) then raise exception 'ACTIVE_SUPER_COIN_AGENT_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor_id::text,72491));
  select count(*) into v_count from public.coin_agent_roles where parent_agent_id=actor_id;
  if v_count>=5 then raise exception 'SUPER_AGENT_CHILD_LIMIT_REACHED: maximum 5 Coin Agents'; end if;
  v_target:=nullif(payload->>'target_id','')::uuid;
  v_whatsapp:=regexp_replace(coalesce(payload->>'whatsapp_number',''),'[^0-9]','','g');
  v_public_name:=nullif(left(trim(coalesce(payload->>'public_name','')),80),'');
  v_public_note:=nullif(left(trim(coalesce(payload->>'public_note','')),240),'');
  if v_target is null or v_target=actor_id or not exists(select 1 from public.profiles where id=v_target and status='active') then raise exception 'ACTIVE_TARGET_USER_REQUIRED'; end if;
  if length(v_whatsapp)<8 or length(v_whatsapp)>15 then raise exception 'WHATSAPP_MUST_BE_8_TO_15_DIGITS'; end if;
  if exists(select 1 from public.coin_agent_roles where user_id=v_target and role in ('coin_agent','super_coin_agent')) then raise exception 'USER_ALREADY_HAS_COIN_AGENT_ROLE'; end if;
  if exists(select 1 from public.coin_sellers where user_id=v_target and is_active) then raise exception 'USER_ALREADY_HAS_ACTIVE_COIN_SELLER'; end if;
  select country into v_country from public.agent_profiles where user_id=actor_id and is_active and coin_agent_enabled and not is_banned;
  select currency_code into v_currency from public.agent_profiles where user_id=actor_id;
  if nullif(trim(coalesce(v_country,'')),'') is null then raise exception 'SUPER_AGENT_COUNTRY_REQUIRED'; end if;
  insert into public.coin_sellers(user_id,country,whatsapp_number,public_name,public_note,is_active,is_listed,assigned_by,updated_at)
  values(v_target,v_country,v_whatsapp,v_public_name,v_public_note,true,true,actor_id,now())
  on conflict(user_id) do update set country=excluded.country,whatsapp_number=excluded.whatsapp_number,public_name=excluded.public_name,
   public_note=excluded.public_note,is_active=true,is_listed=true,assigned_by=actor_id,updated_at=now();
  perform set_config('app.coin_agent_admin_assignment','on',true);
  insert into public.agent_profiles(user_id,currency_code,country,payment_methods,sell_rate,buy_rate,whatsapp_number,is_active,is_banned,
   coin_agent_enabled,diamond_buy_rate_pkr_per_1000,updated_at)
  values(v_target,coalesce(v_currency,'PKR'),v_country,'{}'::jsonb,500,400,v_whatsapp,true,false,true,
   (select min_user_buy_rate_pkr_per_1000 from public.coin_agent_config where id=true),now())
  on conflict(user_id) do update set currency_code=excluded.currency_code,country=excluded.country,whatsapp_number=excluded.whatsapp_number,
   is_active=case when public.agent_profiles.is_banned then false else true end,
   coin_agent_enabled=case when public.agent_profiles.is_banned then false else true end,updated_at=now()
  returning * into v_agent;
  perform set_config('app.coin_agent_admin_assignment','off',true);
  if v_agent.is_banned then raise exception 'TARGET_AGENT_BANNED'; end if;
  insert into public.coin_agent_roles(user_id,role,parent_agent_id,assigned_by,updated_at) values(v_target,'coin_agent',actor_id,actor_id,now());
  insert into public.coin_agent_balances(agent_id,source_type) values(v_target,'profile_diamonds'),(v_target,'red_diamonds') on conflict(agent_id,source_type) do nothing;
  insert into public.coin_seller_inventory(seller_id,available_coins,total_allocated,total_sold) values(v_target,0,0,0) on conflict(seller_id) do nothing;
  insert into public.coin_agent_role_audit(actor_id,target_id,old_role,new_role,old_parent_agent_id,new_parent_agent_id,action,details)
  values(actor_id,v_target,'normal_user','coin_agent',null,actor_id,'super_agent_created_child',
   jsonb_build_object('country',v_country,'whatsapp_last4',right(v_whatsapp,4),'child_limit',5));
  return jsonb_build_object('success',true,'user_id',v_target,'role','coin_agent','parent_agent_id',actor_id,'child_count',v_count+1,'max_children',5);
 else raise exception 'INVALID_ROLE_ACTION';
 end if;
end; $$;
revoke all on function public.coin_agent_role_action(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.coin_agent_role_action(uuid,text,jsonb) to service_role;
