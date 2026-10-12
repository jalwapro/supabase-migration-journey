-- Route shop purchases and custom-theme submission fees through P2P balances.
begin;

create or replace function public.submit_custom_theme(_image_url text)
returns public.custom_themes language plpgsql security definer set search_path=''
as $$
declare
 me uuid:=auth.uid(); v_price bigint; v_duration integer; v_enabled boolean; v_balance bigint;
 v_row public.custom_themes; v_admin record; v_basis public.p2p_coin_cost_basis%rowtype; v_paid bigint; v_cost numeric(30,8);
begin
 if me is null then raise exception 'not authenticated'; end if;
 if _image_url is null or length(_image_url)<5 then raise exception 'invalid image url'; end if;
 select custom_theme_price_coins,custom_theme_duration_hours,custom_theme_enabled into v_price,v_duration,v_enabled
 from public.app_settings where id='global';
 if not coalesce(v_enabled,true) then raise exception 'custom theme submissions are disabled'; end if;
 if exists(select 1 from public.custom_themes where user_id=me and status='pending') then raise exception 'you already have a pending submission'; end if;
 insert into public.p2p_profiles(user_id,role) values(me,'user') on conflict(user_id) do nothing;
 perform 1 from public.p2p_wallets where user_id=me for update;
 select coin_available into v_balance from public.p2p_wallets where user_id=me;
 if coalesce(v_balance,0)<coalesce(v_price,0) then raise exception 'not enough P2P coins (need %)',v_price; end if;
 update public.p2p_wallets set coin_available=coin_available-coalesce(v_price,0),updated_at=now() where user_id=me;
 select * into v_basis from public.p2p_coin_cost_basis where user_id=me for update;
 if found and coalesce(v_basis.coins_remaining,0)>0 then
  v_paid:=least(v_basis.coins_remaining,coalesce(v_price,0));
  v_cost:=round(v_basis.cost_pkr_remaining*v_paid/nullif(v_basis.coins_remaining,0),8);
  update public.p2p_coin_cost_basis set coins_remaining=coins_remaining-v_paid,cost_pkr_remaining=greatest(0,round(cost_pkr_remaining-v_cost,8)),updated_at=now() where user_id=me;
 end if;
 insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,actor_id,metadata)
 values(gen_random_uuid(),'gift_spend','coin',greatest(coalesce(v_price,0),1),me,me,jsonb_build_object('purpose','custom_theme_submission'))
 returning null into v_balance;
 insert into public.custom_themes(user_id,image_url,coins_paid) values(me,_image_url,coalesce(v_price,0)) returning * into v_row;
 for v_admin in select distinct ur.user_id from public.user_roles ur where ur.role in ('admin'::public.app_role,'super_admin'::public.app_role) loop
  insert into public.notifications(user_id,kind,title,body,data,actor_id,entity_type,entity_id)
  values(v_admin.user_id,'system_broadcast','New custom theme pending','A user submitted a custom background for approval',
    jsonb_build_object('custom_theme_id',v_row.id),me,'custom_theme',v_row.id::text);
 end loop;
 return v_row;
end $$;
revoke all on function public.submit_custom_theme(text) from public,anon;
grant execute on function public.submit_custom_theme(text) to authenticated;

create or replace function public.purchase_shop_item(_theme_id uuid,_currency text default 'auto')
returns public.user_themes language plpgsql security definer set search_path=''
as $$
declare
 v_user uuid:=auth.uid(); v_theme public.themes%rowtype; v_currency text; v_price bigint;
 v_expiry timestamptz; v_row public.user_themes; v_wallet public.p2p_wallets%rowtype;
 v_basis public.p2p_coin_cost_basis%rowtype; v_paid bigint; v_cost numeric(30,8);
begin
 if v_user is null then raise exception 'Sign in to buy'; end if;
 select * into v_theme from public.themes where id=_theme_id and is_active;
 if not found then raise exception 'Item not found'; end if;
 v_currency:=lower(coalesce(_currency,'auto'));
 if v_currency='auto' then v_currency:=case when coalesce(v_theme.price_diamonds,0)>0 then 'diamonds' else 'coins' end; end if;
 if v_currency not in ('coins','diamonds') then raise exception 'Invalid currency'; end if;
 v_price:=case when v_currency='diamonds' then v_theme.price_diamonds else v_theme.price end;
 if v_price<0 then raise exception 'Invalid price'; end if;
 insert into public.p2p_profiles(user_id,role) values(v_user,'user') on conflict(user_id) do nothing;
 select * into v_wallet from public.p2p_wallets where user_id=v_user for update;
 if not found then raise exception 'P2P wallet not found'; end if;
 if v_price>0 and v_currency='diamonds' then
  if v_wallet.diamond_available<v_price then raise exception 'Not enough P2P diamonds'; end if;
  update public.p2p_wallets set diamond_available=diamond_available-v_price,updated_at=now() where user_id=v_user;
 elsif v_price>0 then
  if v_wallet.coin_available<v_price then raise exception 'Not enough P2P coins'; end if;
  update public.p2p_wallets set coin_available=coin_available-v_price,updated_at=now() where user_id=v_user;
  select * into v_basis from public.p2p_coin_cost_basis where user_id=v_user for update;
  if found and coalesce(v_basis.coins_remaining,0)>0 then
   v_paid:=least(v_basis.coins_remaining,v_price);
   v_cost:=round(v_basis.cost_pkr_remaining*v_paid/nullif(v_basis.coins_remaining,0),8);
   update public.p2p_coin_cost_basis set coins_remaining=coins_remaining-v_paid,cost_pkr_remaining=greatest(0,round(cost_pkr_remaining-v_cost,8)),updated_at=now() where user_id=v_user;
  end if;
 end if;
 if v_price>0 then
  insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,actor_id,metadata)
  values(gen_random_uuid(),'gift_spend',case when v_currency='diamonds' then 'diamond'::public.p2p_asset else 'coin'::public.p2p_asset end,
    v_price,v_user,v_user,jsonb_build_object('purpose','shop_purchase','theme_id',v_theme.id,'currency',v_currency));
 end if;
 if v_theme.duration_days is not null and v_theme.duration_days>0 then v_expiry:=now()+(v_theme.duration_days||' days')::interval; else v_expiry:=null; end if;
 insert into public.user_themes(user_id,theme_id,expires_at,purchased_price_diamonds)
 values(v_user,_theme_id,v_expiry,case when v_currency='diamonds' then v_price else 0 end)
 on conflict(user_id,theme_id) do update set expires_at=case
  when public.user_themes.expires_at is null then null
  when excluded.expires_at is null then null
  else greatest(public.user_themes.expires_at,now())+(v_theme.duration_days||' days')::interval end,
  purchased_price_diamonds=case when v_currency='diamonds' then v_price else public.user_themes.purchased_price_diamonds end
 returning * into v_row;
 return v_row;
end $$;
revoke all on function public.purchase_shop_item(uuid,text) from public,anon;
grant execute on function public.purchase_shop_item(uuid,text) to authenticated;

commit;
