-- Never offer an agent their own listing as a counterparty.
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
    from public.agent_profiles a join public.profiles p on p.id=a.user_id
    where a.user_id<>actor_id and a.coin_agent_enabled and a.is_active and not a.is_banned
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
    where a.user_id<>actor_id and a.is_active and a.coin_agent_enabled and not a.is_banned
      and exists(select 1 from public.coin_sellers cs where cs.user_id=a.user_id and cs.is_active)
      and lower(trim(a.country))=lower(trim(v_country))
      and a.sell_rate between v_settings.min_agent_coins and v_settings.max_agent_coins
      and exists(select 1 from jsonb_each_text(a.payment_methods) kv where length(trim(kv.value))>0)
  ),'[]'::jsonb);
end;
$$;
revoke all on function public.p2p_marketplace_for_user(uuid) from public,anon,authenticated;
grant execute on function public.p2p_marketplace_for_user(uuid) to service_role;
