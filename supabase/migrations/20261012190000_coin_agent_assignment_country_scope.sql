-- Admin-assigned Coin Agent provisioning and hard country boundaries for both marketplaces.
alter table public.coin_sellers add column if not exists country text not null default 'Pakistan';
update public.coin_sellers cs set country=coalesce(nullif(trim(p.country),''),cs.country,'Pakistan') from public.profiles p where p.id=cs.user_id;
-- Coin Agents are provisioned from the existing Coin Seller admin workflow.
create or replace function public.guard_agent_profile_country()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_country text;
begin
  if current_setting('app.coin_agent_admin_assignment', true) = 'on' then
    new.country := nullif(trim(new.country), '');
    if new.country is null then raise exception 'AGENT_COUNTRY_REQUIRED'; end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.country := old.country;
    new.currency_code := old.currency_code;
  else
    select nullif(trim(p.country), '') into v_profile_country
    from public.profiles p where p.id = new.user_id;
    new.country := coalesce(v_profile_country, new.country, 'Pakistan');
  end if;
  return new;
end;
$$;

drop trigger if exists guard_agent_profile_country_trigger on public.agent_profiles;
create trigger guard_agent_profile_country_trigger
before insert or update of country, currency_code on public.agent_profiles
for each row execute function public.guard_agent_profile_country();

create or replace function public.admin_assign_coin_agent(
  actor_id uuid,
  target_id uuid,
  assigned_country text,
  assigned_currency text default 'PKR',
  enable_agent boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_agent public.agent_profiles%rowtype;
  v_cfg public.coin_agent_config%rowtype;
  v_seller public.coin_sellers%rowtype;
begin
  if actor_id is null or not public.is_admin(actor_id) then raise exception 'ADMIN_REQUIRED'; end if;
  if target_id is null or not exists(select 1 from auth.users where id=target_id) then raise exception 'USER_NOT_FOUND'; end if;
  if nullif(trim(coalesce(assigned_country,'')), '') is null or length(trim(assigned_country)) > 50 then raise exception 'AGENT_COUNTRY_REQUIRED'; end if;
  if length(trim(coalesce(assigned_currency,''))) < 3 or length(trim(assigned_currency)) > 10 then raise exception 'INVALID_CURRENCY'; end if;

  select * into v_seller from public.coin_sellers where user_id=target_id;
  if not found or not v_seller.is_active then raise exception 'ASSIGN_COIN_SELLER_FIRST'; end if;
  select * into v_cfg from public.coin_agent_config where id=true;

  perform set_config('app.coin_agent_admin_assignment','on',true);
  insert into public.agent_profiles(
    user_id,currency_code,country,payment_methods,sell_rate,buy_rate,whatsapp_number,
    is_active,is_banned,coin_agent_enabled,diamond_buy_rate_pkr_per_1000,updated_at
  ) values (
    target_id,upper(trim(assigned_currency)),trim(assigned_country),'{}'::jsonb,500,400,
    v_seller.whatsapp_number,enable_agent,false,enable_agent,
    case when enable_agent then v_cfg.min_user_buy_rate_pkr_per_1000 else null end,now()
  )
  on conflict(user_id) do update set
    currency_code=excluded.currency_code,
    country=excluded.country,
    whatsapp_number=coalesce(nullif(agent_profiles.whatsapp_number,''),excluded.whatsapp_number),
    is_active=case when public.agent_profiles.is_banned then false else enable_agent end,
    coin_agent_enabled=case when public.agent_profiles.is_banned then false else enable_agent end,
    diamond_buy_rate_pkr_per_1000=case when public.agent_profiles.is_banned then public.agent_profiles.diamond_buy_rate_pkr_per_1000
      when enable_agent then coalesce(public.agent_profiles.diamond_buy_rate_pkr_per_1000,excluded.diamond_buy_rate_pkr_per_1000) else public.agent_profiles.diamond_buy_rate_pkr_per_1000 end,
    updated_at=now()
  returning * into v_agent;
  if v_agent.is_banned then raise exception 'AGENT_BANNED'; end if;

  insert into public.coin_agent_balances(agent_id,source_type)
  values(target_id,'profile_diamonds'),(target_id,'red_diamonds')
  on conflict(agent_id,source_type) do nothing;
  insert into public.coin_seller_inventory(seller_id,available_coins,total_allocated,total_sold)
  values(target_id,0,0,0) on conflict(seller_id) do nothing;

  return jsonb_build_object('agent',to_jsonb(v_agent),'country',v_agent.country,'enabled',v_agent.coin_agent_enabled);
end;
$$;
revoke all on function public.admin_assign_coin_agent(uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.admin_assign_coin_agent(uuid,uuid,text,text,boolean) to service_role;

create or replace function public.coin_agent_marketplace_for_user(actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_country text; v_cfg public.coin_agent_config%rowtype;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select nullif(trim(country),'') into v_country from public.profiles where id=actor_id;
  if v_country is null then return '[]'::jsonb; end if;
  select * into v_cfg from public.coin_agent_config where id=true;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id',a.user_id,'username',p.username,'user_code',p.user_code,'country',a.country,
      'currency_code',a.currency_code,'diamond_buy_rate_pkr_per_1000',a.diamond_buy_rate_pkr_per_1000,
      'whatsapp_number',a.whatsapp_number
    ) order by a.diamond_buy_rate_pkr_per_1000 desc)
    from public.agent_profiles a
    join public.profiles p on p.id=a.user_id
    where a.coin_agent_enabled and a.is_active and not a.is_banned
      and lower(trim(a.country))=lower(trim(v_country))
      and exists(select 1 from public.coin_sellers cs where cs.user_id=a.user_id and cs.is_active)
      and a.diamond_buy_rate_pkr_per_1000 between v_cfg.min_user_buy_rate_pkr_per_1000 and v_cfg.max_user_buy_rate_pkr_per_1000
  ),'[]'::jsonb);
end;
$$;
revoke all on function public.coin_agent_marketplace_for_user(uuid) from public,anon,authenticated;
grant execute on function public.coin_agent_marketplace_for_user(uuid) to service_role;

create or replace function public.p2p_marketplace_for_user(actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_country text; v_settings public.system_settings%rowtype;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select nullif(trim(country),'') into v_country from public.profiles where id=actor_id;
  if v_country is null then return '[]'::jsonb; end if;
  select * into v_settings from public.system_settings order by updated_at desc limit 1;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id',a.user_id,'currency_code',a.currency_code,'country',a.country,
      'sell_rate',a.sell_rate,'buy_rate',a.buy_rate,'base_fiat_amount',v_settings.base_fiat_amount,
      'payment_methods',coalesce((select jsonb_agg(key) from jsonb_object_keys(a.payment_methods) as method(key)
        where coalesce(a.payment_methods->>method.key,'')<>''),'[]'::jsonb)
    ) order by a.sell_rate desc)
    from public.agent_profiles a
    where a.is_active and not a.is_banned
      and lower(trim(a.country))=lower(trim(v_country))
      and a.sell_rate between v_settings.min_agent_coins and v_settings.max_agent_coins
      and exists(select 1 from jsonb_each_text(a.payment_methods) kv where length(trim(kv.value))>0)
  ),'[]'::jsonb);
end;
$$;
revoke all on function public.p2p_marketplace_for_user(uuid) from public,anon,authenticated;
grant execute on function public.p2p_marketplace_for_user(uuid) to service_role;

create or replace function public.enforce_p2p_order_country()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_buyer_country text; v_agent_country text;
begin
  select lower(trim(country)) into v_buyer_country from public.profiles where id=new.buyer_id;
  select lower(trim(country)) into v_agent_country from public.agent_profiles where user_id=new.agent_id and is_active and coin_agent_enabled and not is_banned;
  if coalesce(v_buyer_country,'')='' or coalesce(v_agent_country,'')='' or v_buyer_country<>v_agent_country then
    raise exception 'COUNTRY_MISMATCH: P2P agent and buyer must be in the same country';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_p2p_order_country_trigger on public.p2p_orders;
create trigger enforce_p2p_order_country_trigger
before insert on public.p2p_orders
for each row execute function public.enforce_p2p_order_country();

create or replace function public.enforce_coin_agent_trade_country()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user_country text; v_agent_country text;
begin
  select lower(trim(country)) into v_user_country from public.profiles where id=new.user_id;
  select lower(trim(country)) into v_agent_country from public.agent_profiles
    where user_id=new.agent_id and is_active and not is_banned and coin_agent_enabled;
  if coalesce(v_user_country,'')='' or coalesce(v_agent_country,'')='' or v_user_country<>v_agent_country
     or not exists(select 1 from public.coin_sellers cs where cs.user_id=new.agent_id and cs.is_active) then
    raise exception 'COUNTRY_MISMATCH: Coin Agent and user must be in the same country and the agent must be active';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_coin_agent_trade_country_trigger on public.coin_agent_trades;
create trigger enforce_coin_agent_trade_country_trigger
before insert on public.coin_agent_trades
for each row execute function public.enforce_coin_agent_trade_country();


-- A single admin switch disables both the Coin Agent and P2P listings without banning the user.
create or replace function public.admin_set_coin_agent_enabled(
  actor_id uuid,
  target_id uuid,
  enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_agent public.agent_profiles%rowtype;
begin
  if actor_id is null or not public.is_admin(actor_id) then raise exception 'ADMIN_REQUIRED'; end if;
  update public.agent_profiles
    set coin_agent_enabled=coalesce(enabled,false),
        is_active=case when coalesce(enabled,false) and not is_banned then true else false end,
        updated_at=now()
    where user_id=target_id
    returning * into v_agent;
  if not found then raise exception 'AGENT_NOT_FOUND'; end if;
  return jsonb_build_object('agent',to_jsonb(v_agent),'enabled',v_agent.coin_agent_enabled);
end;
$$;
revoke all on function public.admin_set_coin_agent_enabled(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.admin_set_coin_agent_enabled(uuid,uuid,boolean) to service_role;

create or replace function public.guard_agent_profile_active_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_setting('app.coin_agent_admin_assignment', true) = 'on' then return new; end if;
  if not exists(select 1 from public.coin_sellers s where s.user_id=new.user_id and s.is_active) then
    new.is_active := false;
    new.coin_agent_enabled := false;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_agent_profile_active_status_trigger on public.agent_profiles;
create trigger guard_agent_profile_active_status_trigger
before insert or update of is_active, coin_agent_enabled on public.agent_profiles
for each row execute function public.guard_agent_profile_active_status();

create or replace function public.p2p_marketplace_for_user(actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_country text; v_settings public.system_settings%rowtype;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select nullif(trim(country),'') into v_country from public.profiles where id=actor_id;
  if v_country is null then return '[]'::jsonb; end if;
  select * into v_settings from public.system_settings order by updated_at desc limit 1;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id',a.user_id,'currency_code',a.currency_code,'country',a.country,
      'sell_rate',a.sell_rate,'buy_rate',a.buy_rate,'base_fiat_amount',v_settings.base_fiat_amount,
      'payment_methods',coalesce((select jsonb_agg(key) from jsonb_object_keys(a.payment_methods) as method(key)
        where coalesce(a.payment_methods->>method.key,'')<>''),'[]'::jsonb)
    ) order by a.sell_rate desc)
    from public.agent_profiles a
    where a.is_active and a.coin_agent_enabled and not a.is_banned
      and exists(select 1 from public.coin_sellers cs where cs.user_id=a.user_id and cs.is_active)
      and lower(trim(a.country))=lower(trim(v_country))
      and a.sell_rate between v_settings.min_agent_coins and v_settings.max_agent_coins
      and exists(select 1 from jsonb_each_text(a.payment_methods) kv where length(trim(kv.value))>0)
  ),'[]'::jsonb);
end;
$$;
revoke all on function public.p2p_marketplace_for_user(uuid) from public,anon,authenticated;
grant execute on function public.p2p_marketplace_for_user(uuid) to service_role;


create or replace function public.disable_agent_when_coin_seller_suspended()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op='DELETE' then
    update public.agent_profiles set is_active=false,coin_agent_enabled=false,updated_at=now() where user_id=old.user_id;
    return old;
  end if;
  if not new.is_active then
    update public.agent_profiles set is_active=false,coin_agent_enabled=false,updated_at=now() where user_id=new.user_id;
  end if;
  return new;
end;
$$;
drop trigger if exists disable_agent_when_coin_seller_suspended_trigger on public.coin_sellers;
create trigger disable_agent_when_coin_seller_suspended_trigger
after update of is_active or delete on public.coin_sellers
for each row execute function public.disable_agent_when_coin_seller_suspended();


-- One-time backfill: every currently active admin-assigned Coin Seller receives the full agent profile.
do $$
declare v_cfg public.coin_agent_config%rowtype;
begin
  select * into v_cfg from public.coin_agent_config where id=true;
  perform set_config('app.coin_agent_admin_assignment','on',true);
  insert into public.agent_profiles(
    user_id,currency_code,country,payment_methods,sell_rate,buy_rate,whatsapp_number,
    is_active,is_banned,coin_agent_enabled,diamond_buy_rate_pkr_per_1000,updated_at
  )
  select cs.user_id,
    case lower(trim(cs.country))
      when 'pakistan' then 'PKR' when 'india' then 'INR' when 'united states' then 'USD'
      when 'united kingdom' then 'GBP' when 'united arab emirates' then 'AED'
      when 'saudi arabia' then 'SAR' when 'canada' then 'CAD' when 'australia' then 'AUD'
      when 'bangladesh' then 'BDT' when 'turkey' then 'TRY' when 'indonesia' then 'IDR'
      when 'malaysia' then 'MYR' when 'germany' then 'EUR' when 'france' then 'EUR'
      else 'USD' end,
    cs.country,'{}'::jsonb,500,400,cs.whatsapp_number,true,false,true,v_cfg.min_user_buy_rate_pkr_per_1000,now()
  from public.coin_sellers cs
  where cs.is_active
  on conflict(user_id) do update set
    country=excluded.country,
    is_active=case when agent_profiles.is_banned then false else true end,
    coin_agent_enabled=case when agent_profiles.is_banned then false else true end,
    diamond_buy_rate_pkr_per_1000=coalesce(agent_profiles.diamond_buy_rate_pkr_per_1000,excluded.diamond_buy_rate_pkr_per_1000),
    updated_at=now();

  insert into public.coin_agent_balances(agent_id,source_type)
  select cs.user_id,src.source_type
  from public.coin_sellers cs cross join (values('profile_diamonds'),('red_diamonds')) src(source_type)
  where cs.is_active
  on conflict(agent_id,source_type) do nothing;

  insert into public.coin_seller_inventory(seller_id,available_coins,total_allocated,total_sold)
  select cs.user_id,0,0,0 from public.coin_sellers cs where cs.is_active
  on conflict(seller_id) do nothing;
end $$;
