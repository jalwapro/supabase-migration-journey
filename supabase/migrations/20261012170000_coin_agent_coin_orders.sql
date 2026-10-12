create table if not exists public.coin_agent_coin_orders (
 id uuid primary key default gen_random_uuid(),
 agent_id uuid not null references public.agent_profiles(user_id) on delete restrict,
 tier_id uuid not null references public.coin_agent_rate_tiers(id) on delete restrict,
 coin_package bigint not null check(coin_package>0),
 price_pkr numeric(14,2) not null check(price_pkr>0),
 payment_method text not null check(payment_method in ('jazzcash','easypaisa','bank','cash','other')),
 payment_reference text not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 admin_note text,
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists coin_agent_coin_orders_queue on public.coin_agent_coin_orders(status,created_at desc);
alter table public.coin_agent_coin_orders enable row level security;
revoke all on public.coin_agent_coin_orders from anon,authenticated;
grant select on public.coin_agent_coin_orders to authenticated;

create or replace function public.coin_agent_coin_order_action(actor_id uuid, action text, payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_admin boolean:=false;
 v_tier public.coin_agent_rate_tiers%rowtype;
 v_order public.coin_agent_coin_orders%rowtype;
 v_balance bigint;
 v_id uuid;
 v_note text;
begin
 if actor_id is null or not exists(select 1 from auth.users where id=actor_id) then raise exception 'AUTH_REQUIRED'; end if;
 v_admin:=public.is_admin(actor_id);
 if action='LIST' then
  return coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.coin_agent_coin_orders where agent_id=actor_id or v_admin order by created_at desc limit 100)x),'[]'::jsonb);
 elsif action='CREATE' then
  select * into v_tier from public.coin_agent_rate_tiers where id=nullif(payload->>'tier_id','')::uuid and agent_id=actor_id and tier_type='coin_purchase' and is_active;
  if not found then raise exception 'COIN_PACKAGE_NOT_FOUND'; end if;
  if not exists(select 1 from public.agent_profiles where user_id=actor_id and is_active and not is_banned and coin_agent_enabled) then raise exception 'AGENT_NOT_ACTIVE'; end if;
  if not exists(select 1 from public.coin_sellers where user_id=actor_id and is_active) then raise exception 'AGENT_MUST_BE_ACTIVE_COIN_SELLER'; end if;
  if length(trim(coalesce(payload->>'payment_reference','')))<3 then raise exception 'PAYMENT_REFERENCE_REQUIRED'; end if;
  insert into public.coin_agent_coin_orders(agent_id,tier_id,coin_package,price_pkr,payment_method,payment_reference)
   values(actor_id,v_tier.id,v_tier.coin_package,v_tier.price_pkr,coalesce(payload->>'payment_method','jazzcash'),left(trim(payload->>'payment_reference'),160))
   returning * into v_order;
  return to_jsonb(v_order);
 elsif action in ('APPROVE','REJECT') then
  if not v_admin then raise exception 'ADMIN_REQUIRED'; end if;
  v_id:=nullif(payload->>'order_id','')::uuid;
  select * into v_order from public.coin_agent_coin_orders where id=v_id for update;
  if not found or v_order.status<>'pending' then raise exception 'COIN_ORDER_NOT_PENDING'; end if;
  v_note:=nullif(left(trim(coalesce(payload->>'admin_note','')),500),'');
  if action='REJECT' then
   update public.coin_agent_coin_orders set status='rejected',admin_note=v_note,reviewed_by=actor_id,reviewed_at=now() where id=v_id returning * into v_order;
  else
   if not exists(select 1 from public.coin_sellers where user_id=v_order.agent_id and is_active) then raise exception 'AGENT_MUST_BE_ACTIVE_COIN_SELLER'; end if;
   insert into public.coin_seller_inventory(seller_id,available_coins,total_allocated,total_sold) values(v_order.agent_id,0,0,0) on conflict(seller_id) do nothing;
   update public.coin_seller_inventory set available_coins=available_coins+v_order.coin_package,total_allocated=total_allocated+v_order.coin_package,updated_at=now() where seller_id=v_order.agent_id returning available_coins into v_balance;
   insert into public.coin_seller_funding_audit(seller_id,amount_pkr,coins_credited,coins_per_pkr,payment_method,payment_reference,note,inventory_before,inventory_after,verified_by,verified_at)
   values(v_order.agent_id,v_order.price_pkr,v_order.coin_package,round(v_order.coin_package::numeric/v_order.price_pkr,6),v_order.payment_method,v_order.payment_reference,v_note,v_balance-v_order.coin_package,v_balance,actor_id,now());
   insert into public.coin_seller_transactions(seller_id,kind,coins,inventory_delta,seller_balance_after,payment_reference,note,created_by)
   values(v_order.agent_id,'allocation',v_order.coin_package,v_order.coin_package,v_balance,v_order.payment_reference,'Admin verified Coin Agent package order '||v_order.id::text,actor_id);
   update public.coin_agent_coin_orders set status='approved',admin_note=v_note,reviewed_by=actor_id,reviewed_at=now() where id=v_id returning * into v_order;
  end if;
  return to_jsonb(v_order);
 else raise exception 'INVALID_ACTION'; end if;
end;
$$;
revoke all on function public.coin_agent_coin_order_action(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.coin_agent_coin_order_action(uuid,text,jsonb) to service_role;
