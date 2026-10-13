-- Cut VIP subscriptions, theme-shop purchases, and custom-theme fees over to
-- the new P2P wallets. These functions never mutate legacy profile coin/diamond
-- balances; ownership/subscription records and notifications remain unchanged.
begin;

create or replace function public.purchase_vip(_tier_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  u uuid:=auth.uid(); t public.vip_tiers%rowtype; c bigint; basis numeric(30,8);
  cost_used numeric(30,8); old_exp timestamptz; new_exp timestamptz; sid uuid;
begin
  if u is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  insert into public.p2p_profiles(user_id,role,active) values(u,'user',true) on conflict(user_id) do nothing;
  select * into t from public.vip_tiers where id=_tier_id and is_active for update;
  if not found then raise exception 'VIP subscription plan not found or inactive' using errcode='P0002'; end if;
  select coin_available,coin_cost_pkr_remaining into c,basis from public.p2p_wallets where user_id=u for update;
  if not found or coalesce(c,0)<t.price then raise exception 'Insufficient P2P coins' using errcode='P0001'; end if;
  cost_used:=case when c>0 then round(coalesce(basis,0)*t.price/c,8) else 0 end;
  select max(expires_at) into old_exp from public.vip_subscriptions where user_id=u and status='active' and expires_at>now();
  new_exp:=case when old_exp is not null then old_exp+make_interval(days=>t.duration_days) else now()+make_interval(days=>t.duration_days) end;

  update public.p2p_wallets set coin_available=coin_available-t.price,
    coin_cost_pkr_remaining=greatest(0,coin_cost_pkr_remaining-cost_used),updated_at=now() where user_id=u;
  perform set_config('app.trusted_definer','on',true);
  update public.profiles set is_vip=true,vip_expiry=new_exp,vip_tier=t.name,vip_updated_at=now(),updated_at=now() where id=u;
  perform set_config('app.trusted_definer','off',true);

  insert into public.vip_subscriptions(user_id,tier_id,tier_name,started_at,expires_at,price_coins,status)
  values(u,t.id,t.name,now(),new_exp,t.price,'active') returning id into sid;
  update public.vip_subscriptions set status=case when expires_at>now() then 'active' else 'expired' end,updated_at=now()
    where user_id=u and id<>sid and status='active';
  insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,actor_id,metadata)
  values(gen_random_uuid(),'coin_spend','coin',t.price,u,u,jsonb_build_object('purpose','vip_subscription','tier_id',t.id,'tier_name',t.name));
  insert into public.wallet_transactions(user_id,kind,coins,coins_delta,ref_type,ref_id,note)
  values(u,'vip_subscription_purchase',-t.price,-t.price,'vip_subscription',t.id,'VIP Subscription: '||t.name||' ('||t.duration_days||'d)');
  return jsonb_build_object('ok',true,'subscription_id',sid,'tier',t.name,'subscription_tier',t.name,'coins_after',c-t.price,'expires_at',new_exp);
exception when others then
  perform set_config('app.trusted_definer','off',true);
  raise;
end $$;
revoke all on function public.purchase_vip(uuid) from public,anon;
grant execute on function public.purchase_vip(uuid) to authenticated;

create or replace function public.purchase_shop_item(_theme_id uuid,_currency text default 'auto')
returns public.user_themes
language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid:=auth.uid(); v_theme public.themes%rowtype; v_currency text; v_price bigint;
  v_expires timestamptz; v_row public.user_themes%rowtype; v_is_vip boolean;
  v_coin_balance bigint; v_coin_basis numeric(30,8); v_cost_used numeric(30,8);
begin
  if v_uid is null then raise exception 'Sign in to buy'; end if;
  insert into public.p2p_profiles(user_id,role,active) values(v_uid,'user',true) on conflict(user_id) do nothing;
  select * into v_theme from public.themes where id=_theme_id and is_active for update;
  if not found then raise exception 'Item not found'; end if;

  if v_theme.is_premium then
    select (is_vip and (vip_expiry is null or vip_expiry>now())) into v_is_vip from public.profiles where id=v_uid;
    if not coalesce(v_is_vip,false) then raise exception 'VIP membership required to buy this item' using errcode='42501'; end if;
  end if;

  v_currency:=lower(coalesce(_currency,'auto'));
  if v_currency='auto' then v_currency:=case when coalesce(v_theme.price_diamonds,0)>0 then 'diamonds' else 'coins' end; end if;
  if v_currency not in ('coins','diamonds') then raise exception 'Invalid purchase currency'; end if;

  if v_currency='diamonds' then
    v_price:=coalesce(v_theme.price_diamonds,0);
    if v_price>0 then
      perform 1 from public.p2p_wallets where user_id=v_uid for update;
      if not found then raise exception 'P2P_WALLET_REQUIRED'; end if;
      update public.p2p_wallets set diamond_available=diamond_available-v_price,updated_at=now()
        where user_id=v_uid and diamond_available>=v_price;
      if not found then raise exception 'Not enough P2P diamonds'; end if;
      insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,actor_id,metadata)
      values(gen_random_uuid(),'diamond_spend','diamond',v_price,v_uid,v_uid,jsonb_build_object('purpose','shop_purchase','theme_id',v_theme.id,'theme_name',v_theme.name));
      insert into public.wallet_transactions(user_id,kind,diamonds_delta,ref_type,ref_id,note)
      values(v_uid,'shop_purchase',-v_price,'theme',v_theme.id,'Bought '||v_theme.name);
    end if;
  else
    v_price:=coalesce(v_theme.price,0);
    if v_price>0 then
      select coin_available,coin_cost_pkr_remaining into v_coin_balance,v_coin_basis from public.p2p_wallets where user_id=v_uid for update;
      if not found or coalesce(v_coin_balance,0)<v_price then raise exception 'Not enough P2P coins'; end if;
      v_cost_used:=case when v_coin_balance>0 then round(coalesce(v_coin_basis,0)*v_price/v_coin_balance,8) else 0 end;
      update public.p2p_wallets set coin_available=coin_available-v_price,
        coin_cost_pkr_remaining=greatest(0,coin_cost_pkr_remaining-v_cost_used),updated_at=now() where user_id=v_uid;
      insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,actor_id,metadata)
      values(gen_random_uuid(),'coin_spend','coin',v_price,v_uid,v_uid,jsonb_build_object('purpose','shop_purchase','theme_id',v_theme.id,'theme_name',v_theme.name,'coin_cost_pkr',v_cost_used));
      insert into public.wallet_transactions(user_id,kind,coins_delta,ref_type,ref_id,note)
      values(v_uid,'shop_purchase',-v_price,'theme',v_theme.id,'Bought '||v_theme.name);
    end if;
  end if;

  if v_theme.duration_days is not null and v_theme.duration_days>0 then
    v_expires:=now()+(v_theme.duration_days||' days')::interval;
  else v_expires:=null; end if;
  insert into public.user_themes(user_id,theme_id,expires_at,purchased_price_diamonds)
  values(v_uid,_theme_id,v_expires,v_theme.price_diamonds)
  on conflict(user_id,theme_id) do update set
    expires_at=case when public.user_themes.expires_at is null then null
      when excluded.expires_at is null then null
      else greatest(public.user_themes.expires_at,now())+(v_theme.duration_days||' days')::interval end,
    purchased_price_diamonds=v_theme.price_diamonds
  returning * into v_row;
  return v_row;
end $$;
revoke all on function public.purchase_shop_item(uuid,text) from public,anon;
grant execute on function public.purchase_shop_item(uuid,text) to authenticated;

create or replace function public.submit_custom_theme(_image_url text)
returns public.custom_themes
language plpgsql security definer set search_path=''
as $$
declare
  me uuid:=auth.uid(); price int; dur_h int; enabled boolean;
  bal bigint; basis numeric(30,8); cost_used numeric(30,8);
  row public.custom_themes; admin_row record;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if _image_url is null or length(_image_url)<5 then raise exception 'invalid image url'; end if;
  insert into public.p2p_profiles(user_id,role,active) values(me,'user',true) on conflict(user_id) do nothing;
  select custom_theme_price_coins,custom_theme_duration_hours,custom_theme_enabled
    into price,dur_h,enabled from public.app_settings where id='global';
  if not coalesce(enabled,true) then raise exception 'custom theme submissions are disabled'; end if;
  if exists(select 1 from public.custom_themes where user_id=me and status='pending') then
    raise exception 'you already have a pending submission';
  end if;
  select coin_available,coin_cost_pkr_remaining into bal,basis from public.p2p_wallets where user_id=me for update;
  if not found or coalesce(bal,0)<coalesce(price,0) then raise exception 'not enough P2P coins (need %)',coalesce(price,0); end if;
  cost_used:=case when bal>0 then round(coalesce(basis,0)*coalesce(price,0)/bal,8) else 0 end;
  update public.p2p_wallets set coin_available=coin_available-coalesce(price,0),
    coin_cost_pkr_remaining=greatest(0,coin_cost_pkr_remaining-cost_used),updated_at=now() where user_id=me;
  insert into public.custom_themes(user_id,image_url,coins_paid)
    values(me,_image_url,coalesce(price,0)) returning * into row;
  if coalesce(price,0)>0 then
    insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,actor_id,metadata)
    values(gen_random_uuid(),'coin_spend','coin',price,me,me,jsonb_build_object('purpose','custom_theme_submission','custom_theme_id',row.id,'coin_cost_pkr',cost_used));
    insert into public.wallet_transactions(user_id,kind,coins_delta,ref_type,ref_id,note)
    values(me,'custom_theme_submission',-price,'custom_theme',row.id,'Custom theme submission fee');
  end if;
  for admin_row in select distinct ur.user_id from public.user_roles ur where ur.role in ('admin'::public.app_role,'super_admin'::public.app_role)
  loop
    insert into public.notifications(user_id,kind,title,body,data,actor_id,entity_type,entity_id)
    values(admin_row.user_id,'system_broadcast','New custom theme pending','A user submitted a custom background for approval',
      jsonb_build_object('custom_theme_id',row.id),me,'custom_theme',row.id::text);
  end loop;
  return row;
end $$;
revoke all on function public.submit_custom_theme(text) from public,anon;
grant execute on function public.submit_custom_theme(text) to authenticated;

commit;
