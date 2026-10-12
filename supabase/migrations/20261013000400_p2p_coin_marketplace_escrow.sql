-- P2P marketplace completion: agent pricing, coin escrow orders, proof, chat, appeals.
-- This is isolated from the legacy wallet and does not touch LiveKit.
begin;

alter table public.p2p_wallets
  add column if not exists coin_locked bigint not null default 0 check (coin_locked >= 0);

create table if not exists public.p2p_market_settings (
  singleton boolean primary key default true check (singleton),
  base_price_pkr numeric(12,2) not null default 50 check (base_price_pkr > 0),
  base_coins bigint not null default 500 check (base_coins > 0),
  min_agent_coins_per_bundle bigint not null default 500 check (min_agent_coins_per_bundle > 0),
  max_agent_coins_per_bundle bigint not null default 600 check (max_agent_coins_per_bundle >= min_agent_coins_per_bundle),
  active boolean not null default true,
  updated_by uuid references public.p2p_profiles(user_id) on delete restrict,
  updated_at timestamptz not null default now()
);
insert into public.p2p_market_settings(singleton) values(true) on conflict(singleton) do nothing;

create table if not exists public.p2p_agent_settings (
  agent_id uuid primary key references public.p2p_profiles(user_id) on delete restrict,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  coins_per_bundle bigint not null check (coins_per_bundle > 0),
  payment_methods text[] not null check (cardinality(payment_methods) > 0),
  payment_details jsonb not null default '{}'::jsonb,
  min_order_coins bigint not null default 500 check (min_order_coins > 0),
  max_order_coins bigint not null default 100000 check (max_order_coins >= min_order_coins),
  is_listed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.p2p_coin_orders (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null,
  buyer_id uuid not null references public.p2p_profiles(user_id) on delete restrict,
  agent_id uuid not null references public.p2p_profiles(user_id) on delete restrict,
  super_agent_id uuid not null references public.p2p_profiles(user_id) on delete restrict,
  amount_coins bigint not null check (amount_coins > 0),
  fiat_currency text not null check (fiat_currency ~ '^[A-Z]{3}$'),
  fiat_amount numeric(20,2) not null check (fiat_amount > 0),
  payment_method text not null,
  status text not null default 'pending_payment'
    check (status in ('pending_payment','payment_submitted','completed','cancelled','appealed','resolved_to_buyer','resolved_to_agent')),
  payment_reference text,
  proof_path text,
  created_at timestamptz not null default now(),
  payment_submitted_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(buyer_id,request_key),
  check (buyer_id <> agent_id and buyer_id <> super_agent_id)
);
create index if not exists p2p_coin_orders_buyer_idx on public.p2p_coin_orders(buyer_id,created_at desc);
create index if not exists p2p_coin_orders_agent_idx on public.p2p_coin_orders(agent_id,status,created_at desc);
create index if not exists p2p_coin_orders_super_idx on public.p2p_coin_orders(super_agent_id,status,created_at desc);

create table if not exists public.p2p_order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.p2p_coin_orders(id) on delete cascade,
  sender_id uuid not null references public.p2p_profiles(user_id) on delete restrict,
  message text not null check (length(trim(message)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists p2p_order_messages_order_idx on public.p2p_order_messages(order_id,created_at);

create table if not exists public.p2p_order_appeals (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.p2p_coin_orders(id) on delete restrict,
  opened_by uuid not null references public.p2p_profiles(user_id) on delete restrict,
  reason text not null check (length(trim(reason)) between 5 and 2000),
  status text not null default 'open' check(status in ('open','resolved_to_buyer','resolved_to_agent')),
  resolution_note text,
  resolved_by uuid references public.p2p_profiles(user_id) on delete restrict,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.p2p_market_settings enable row level security;
alter table public.p2p_agent_settings enable row level security;
alter table public.p2p_coin_orders enable row level security;
alter table public.p2p_order_messages enable row level security;
alter table public.p2p_order_appeals enable row level security;

create policy p2p_market_settings_read on public.p2p_market_settings for select to authenticated using(active);
create policy p2p_agent_settings_market_read on public.p2p_agent_settings for select to authenticated using(is_listed and exists(
  select 1 from public.p2p_profiles p where p.user_id=agent_id and p.role='sub_agent' and p.active
));
create policy p2p_agent_settings_owner_read on public.p2p_agent_settings for select to authenticated using(agent_id=(select auth.uid()));
create policy p2p_agent_settings_admin_read on public.p2p_agent_settings for select to authenticated using((select p2p_private.current_role())='admin');
create policy p2p_coin_orders_parties_read on public.p2p_coin_orders for select to authenticated using(
  buyer_id=(select auth.uid()) or agent_id=(select auth.uid()) or super_agent_id=(select auth.uid())
  or (select p2p_private.current_role())='admin'
);
create policy p2p_order_messages_parties_read on public.p2p_order_messages for select to authenticated using(exists(
  select 1 from public.p2p_coin_orders o where o.id=order_id and
  (o.buyer_id=(select auth.uid()) or o.agent_id=(select auth.uid()) or o.super_agent_id=(select auth.uid()) or (select p2p_private.current_role())='admin')
));
create policy p2p_order_messages_parties_insert on public.p2p_order_messages for insert to authenticated with check(
  sender_id=(select auth.uid()) and exists(select 1 from public.p2p_coin_orders o where o.id=order_id and
  o.status in ('pending_payment','payment_submitted','appealed') and
  (o.buyer_id=(select auth.uid()) or o.agent_id=(select auth.uid()) or o.super_agent_id=(select auth.uid())))
);
create policy p2p_order_appeals_parties_read on public.p2p_order_appeals for select to authenticated using(
  opened_by=(select auth.uid()) or exists(select 1 from public.p2p_coin_orders o where o.id=order_id and
  (o.agent_id=(select auth.uid()) or o.super_agent_id=(select auth.uid()))) or (select p2p_private.current_role())='admin'
);

grant select on public.p2p_market_settings,public.p2p_agent_settings,public.p2p_coin_orders,public.p2p_order_messages,public.p2p_order_appeals to authenticated;
grant insert on public.p2p_order_messages to authenticated;
revoke insert,update,delete on public.p2p_agent_settings,public.p2p_coin_orders,public.p2p_order_appeals from anon,authenticated;
revoke update,delete on public.p2p_order_messages from anon,authenticated;

create or replace function public.p2p_admin_set_market_settings(
  p_base_price_pkr numeric, p_base_coins bigint, p_min_agent_coins_per_bundle bigint, p_max_agent_coins_per_bundle bigint, p_active boolean default true
) returns void language plpgsql security definer set search_path=''
as $$
begin
  if (select p2p_private.current_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_base_price_pkr is null or p_base_price_pkr<=0 or p_base_coins is null or p_base_coins<=0
     or p_min_agent_coins_per_bundle is null or p_min_agent_coins_per_bundle<=0
     or p_max_agent_coins_per_bundle<p_min_agent_coins_per_bundle then raise exception 'INVALID_MARKET_SETTINGS'; end if;
  update public.p2p_market_settings set base_price_pkr=p_base_price_pkr,base_coins=p_base_coins,
    min_agent_coins_per_bundle=p_min_agent_coins_per_bundle,max_agent_coins_per_bundle=p_max_agent_coins_per_bundle,
    active=p_active,updated_by=auth.uid(),updated_at=now() where singleton=true;
end $$;
revoke all on function public.p2p_admin_set_market_settings(numeric,bigint,bigint,bigint,boolean) from public,anon;
grant execute on function public.p2p_admin_set_market_settings(numeric,bigint,bigint,bigint,boolean) to authenticated;

create or replace function public.p2p_agent_set_market_profile(
  p_country_code text, p_currency_code text, p_coins_per_bundle bigint, p_payment_methods text[],
  p_payment_details jsonb, p_min_order_coins bigint, p_max_order_coins bigint, p_is_listed boolean default true
) returns void language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_market public.p2p_market_settings%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.p2p_profiles where user_id=v_user and role='sub_agent' and active) then raise exception 'ACTIVE_SUB_AGENT_REQUIRED'; end if;
  select * into v_market from public.p2p_market_settings where singleton=true and active;
  if not found then raise exception 'MARKET_DISABLED'; end if;
  if p_country_code !~ '^[A-Z]{2}$' or p_currency_code !~ '^[A-Z]{3}$'
    or p_coins_per_bundle<v_market.min_agent_coins_per_bundle or p_coins_per_bundle>v_market.max_agent_coins_per_bundle
    or p_min_order_coins is null or p_min_order_coins<=0 or p_max_order_coins<p_min_order_coins
    or coalesce(cardinality(p_payment_methods),0)=0 then raise exception 'INVALID_AGENT_MARKET_PROFILE'; end if;
  if exists(select 1 from unnest(p_payment_methods) m where m not in ('JazzCash','Easypaisa','Bank Transfer','Raast','Other')) then
    raise exception 'UNSUPPORTED_PAYMENT_METHOD'; end if;
  insert into public.p2p_agent_settings(agent_id,country_code,currency_code,coins_per_bundle,payment_methods,payment_details,min_order_coins,max_order_coins,is_listed,updated_at)
  values(v_user,p_country_code,p_currency_code,p_coins_per_bundle,p_payment_methods,coalesce(p_payment_details,'{}'::jsonb),p_min_order_coins,p_max_order_coins,p_is_listed,now())
  on conflict(agent_id) do update set country_code=excluded.country_code,currency_code=excluded.currency_code,
    coins_per_bundle=excluded.coins_per_bundle,payment_methods=excluded.payment_methods,payment_details=excluded.payment_details,
    min_order_coins=excluded.min_order_coins,max_order_coins=excluded.max_order_coins,is_listed=excluded.is_listed,updated_at=now();
end $$;
revoke all on function public.p2p_agent_set_market_profile(text,text,bigint,text[],jsonb,bigint,bigint,boolean) from public,anon;
grant execute on function public.p2p_agent_set_market_profile(text,text,bigint,text[],jsonb,bigint,bigint,boolean) to authenticated;

create or replace function public.p2p_create_coin_order(p_request_key uuid,p_agent_id uuid,p_amount_coins bigint,p_payment_method text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_agent public.p2p_agent_settings%rowtype; v_super uuid; v_market public.p2p_market_settings%rowtype;
  v_order uuid; v_fiat numeric(20,2); v_old public.p2p_coin_orders%rowtype;
begin
  if v_user is null or p_request_key is null or p_agent_id is null or p_amount_coins is null or p_amount_coins<=0 then raise exception 'INVALID_ORDER'; end if;
  select * into v_old from public.p2p_coin_orders where buyer_id=v_user and request_key=p_request_key;
  if found then
    if v_old.agent_id=p_agent_id and v_old.amount_coins=p_amount_coins and v_old.payment_method=p_payment_method then return v_old.id; end if;
    raise exception 'IDEMPOTENCY_KEY_REUSED';
  end if;
  if not exists(select 1 from public.p2p_profiles where user_id=v_user and role='user' and active) then raise exception 'ACTIVE_USER_REQUIRED'; end if;
  select * into v_agent from public.p2p_agent_settings where agent_id=p_agent_id and is_listed;
  if not found or not exists(select 1 from public.p2p_profiles where user_id=p_agent_id and role='sub_agent' and active) then raise exception 'AGENT_NOT_AVAILABLE'; end if;
  if p_amount_coins<v_agent.min_order_coins or p_amount_coins>v_agent.max_order_coins then raise exception 'ORDER_AMOUNT_OUT_OF_RANGE'; end if;
  if not (p_payment_method=any(v_agent.payment_methods)) then raise exception 'PAYMENT_METHOD_NOT_SUPPORTED'; end if;
  select * into v_market from public.p2p_market_settings where singleton=true and active;
  if not found then raise exception 'MARKET_DISABLED'; end if;
  v_fiat:=round((p_amount_coins::numeric/v_agent.coins_per_bundle)*v_market.base_price_pkr,2);
  select super_agent_id into v_super from public.p2p_profiles where user_id=p_agent_id and role='sub_agent' and active;
  if v_super is null or not p2p_private.valid_agent_pair(p_agent_id,v_super) then raise exception 'AGENT_HIERARCHY_INVALID'; end if;
  perform 1 from public.p2p_wallets where user_id=p_agent_id for update;
  if not found then raise exception 'AGENT_WALLET_NOT_FOUND'; end if;
  update public.p2p_wallets set coin_available=coin_available-p_amount_coins,coin_locked=coin_locked+p_amount_coins,updated_at=now()
    where user_id=p_agent_id and coin_available>=p_amount_coins;
  if not found then raise exception 'AGENT_INSUFFICIENT_STOCK'; end if;
  insert into public.p2p_coin_orders(request_key,buyer_id,agent_id,super_agent_id,amount_coins,fiat_currency,fiat_amount,payment_method)
  values(p_request_key,v_user,p_agent_id,v_super,p_amount_coins,v_agent.currency_code,v_fiat,p_payment_method) returning id into v_order;
  insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,to_user_id,actor_id,metadata)
  values(gen_random_uuid(),'coin_transfer','coin',p_amount_coins,p_agent_id,v_user,v_user,jsonb_build_object('phase','order_escrow_lock','order_id',v_order));
  return v_order;
end $$;
revoke all on function public.p2p_create_coin_order(uuid,uuid,bigint,text) from public,anon;
grant execute on function public.p2p_create_coin_order(uuid,uuid,bigint,text) to authenticated;

create or replace function public.p2p_submit_coin_order_payment(p_order_id uuid,p_payment_reference text,p_proof_path text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_order public.p2p_coin_orders%rowtype;
begin
  if v_user is null or length(trim(coalesce(p_payment_reference,'')))<3 or length(trim(coalesce(p_proof_path,'')))<5 then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;
  select * into v_order from public.p2p_coin_orders where id=p_order_id for update;
  if not found or v_order.buyer_id<>v_user or v_order.status<>'pending_payment' then raise exception 'ORDER_NOT_PAYABLE'; end if;
  if split_part(p_proof_path,'/',1)<>p_order_id::text then raise exception 'INVALID_PROOF_PATH'; end if;
  update public.p2p_coin_orders set payment_reference=trim(p_payment_reference),proof_path=p_proof_path,status='payment_submitted',payment_submitted_at=now(),updated_at=now() where id=p_order_id;
  insert into public.p2p_notifications(recipient_id,event_type,payload)
  values(v_order.agent_id,'coin_order_payment_submitted',jsonb_build_object('order_id',p_order_id,'amount',v_order.amount_coins));
end $$;
revoke all on function public.p2p_submit_coin_order_payment(uuid,text,text) from public,anon;
grant execute on function public.p2p_submit_coin_order_payment(uuid,text,text) to authenticated;

create or replace function public.p2p_agent_complete_coin_order(p_order_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_order public.p2p_coin_orders%rowtype;
begin
  select * into v_order from public.p2p_coin_orders where id=p_order_id for update;
  if not found or v_order.agent_id<>v_user or v_order.status<>'payment_submitted' then raise exception 'ORDER_NOT_COMPLETABLE'; end if;
  perform 1 from public.p2p_wallets where user_id in (v_order.agent_id,v_order.buyer_id) order by user_id for update;
  if (select count(*) from public.p2p_wallets where user_id in (v_order.agent_id,v_order.buyer_id))<>2 then raise exception 'P2P_WALLET_REQUIRED'; end if;
  update public.p2p_wallets set coin_locked=coin_locked-v_order.amount_coins,updated_at=now()
    where user_id=v_order.agent_id and coin_locked>=v_order.amount_coins;
  if not found then raise exception 'ESCROW_BALANCE_INVALID'; end if;
  update public.p2p_wallets set coin_available=coin_available+v_order.amount_coins,updated_at=now() where user_id=v_order.buyer_id;
  update public.p2p_coin_orders set status='completed',completed_at=now(),updated_at=now() where id=p_order_id;
  insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,to_user_id,actor_id,metadata)
  values(gen_random_uuid(),'coin_transfer','coin',v_order.amount_coins,v_order.agent_id,v_order.buyer_id,v_user,jsonb_build_object('phase','order_escrow_release','order_id',p_order_id));
end $$;
revoke all on function public.p2p_agent_complete_coin_order(uuid) from public,anon;
grant execute on function public.p2p_agent_complete_coin_order(uuid) to authenticated;

create or replace function public.p2p_cancel_coin_order(p_order_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_order public.p2p_coin_orders%rowtype;
begin
  select * into v_order from public.p2p_coin_orders where id=p_order_id for update;
  if not found or v_order.status<>'pending_payment' or v_user not in (v_order.buyer_id,v_order.agent_id) then raise exception 'ORDER_NOT_CANCELLABLE'; end if;
  update public.p2p_wallets set coin_locked=coin_locked-v_order.amount_coins,coin_available=coin_available+v_order.amount_coins,updated_at=now()
    where user_id=v_order.agent_id and coin_locked>=v_order.amount_coins;
  if not found then raise exception 'ESCROW_BALANCE_INVALID'; end if;
  update public.p2p_coin_orders set status='cancelled',updated_at=now() where id=p_order_id;
  insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,to_user_id,actor_id,metadata)
  values(gen_random_uuid(),'coin_transfer','coin',v_order.amount_coins,v_order.agent_id,v_order.agent_id,v_user,jsonb_build_object('phase','order_escrow_refund','order_id',p_order_id));
end $$;
revoke all on function public.p2p_cancel_coin_order(uuid) from public,anon;
grant execute on function public.p2p_cancel_coin_order(uuid) to authenticated;

create or replace function public.p2p_open_coin_order_appeal(p_order_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_order public.p2p_coin_orders%rowtype; v_appeal uuid;
begin
  select * into v_order from public.p2p_coin_orders where id=p_order_id for update;
  if not found or v_order.buyer_id<>v_user or v_order.status not in ('payment_submitted') then raise exception 'ORDER_NOT_APPEALABLE'; end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'APPEAL_REASON_REQUIRED'; end if;
  insert into public.p2p_order_appeals(order_id,opened_by,reason) values(p_order_id,v_user,trim(p_reason)) returning id into v_appeal;
  update public.p2p_coin_orders set status='appealed',updated_at=now() where id=p_order_id;
  insert into public.p2p_notifications(recipient_id,event_type,payload)
  values(v_order.super_agent_id,'coin_order_appealed',jsonb_build_object('order_id',p_order_id,'appeal_id',v_appeal));
  return v_appeal;
end $$;
revoke all on function public.p2p_open_coin_order_appeal(uuid,text) from public,anon;
grant execute on function public.p2p_open_coin_order_appeal(uuid,text) to authenticated;

create or replace function public.p2p_admin_resolve_coin_order_appeal(p_appeal_id uuid,p_resolution text,p_note text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_appeal public.p2p_order_appeals%rowtype; v_order public.p2p_coin_orders%rowtype;
begin
  if (select p2p_private.current_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_resolution not in ('resolved_to_buyer','resolved_to_agent') then raise exception 'INVALID_RESOLUTION'; end if;
  select * into v_appeal from public.p2p_order_appeals where id=p_appeal_id for update;
  if not found or v_appeal.status<>'open' then raise exception 'APPEAL_NOT_OPEN'; end if;
  select * into v_order from public.p2p_coin_orders where id=v_appeal.order_id for update;
  perform 1 from public.p2p_wallets where user_id in (v_order.agent_id,v_order.buyer_id) order by user_id for update;
  if v_order.status<>'appealed' or (select count(*) from public.p2p_wallets where user_id in (v_order.agent_id,v_order.buyer_id))<>2 then raise exception 'ORDER_STATE_INVALID'; end if;
  if p_resolution='resolved_to_buyer' then
    update public.p2p_wallets set coin_locked=coin_locked-v_order.amount_coins,updated_at=now() where user_id=v_order.agent_id and coin_locked>=v_order.amount_coins;
    if not found then raise exception 'ESCROW_BALANCE_INVALID'; end if;
    update public.p2p_wallets set coin_available=coin_available+v_order.amount_coins,updated_at=now() where user_id=v_order.buyer_id;
  else
    update public.p2p_wallets set coin_locked=coin_locked-v_order.amount_coins,coin_available=coin_available+v_order.amount_coins,updated_at=now()
      where user_id=v_order.agent_id and coin_locked>=v_order.amount_coins;
    if not found then raise exception 'ESCROW_BALANCE_INVALID'; end if;
  end if;
  update public.p2p_coin_orders set status=p_resolution,updated_at=now() where id=v_order.id;
  update public.p2p_order_appeals set status=p_resolution,resolution_note=nullif(trim(p_note),''),resolved_by=v_user,resolved_at=now() where id=p_appeal_id;
end $$;
revoke all on function public.p2p_admin_resolve_coin_order_appeal(uuid,text,text) from public,anon;
grant execute on function public.p2p_admin_resolve_coin_order_appeal(uuid,text,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('p2p_order_proofs','p2p_order_proofs',false,5242880,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
create policy p2p_order_proof_upload_owner on storage.objects for insert to authenticated with check(
  bucket_id='p2p_order_proofs' and split_part(name,'/',1) ~ '^[0-9a-fA-F-]{36}$'
  and exists(select 1 from public.p2p_coin_orders o where o.id=split_part(name,'/',1)::uuid and o.buyer_id=(select auth.uid()) and o.status='pending_payment')
);
create policy p2p_order_proof_read_parties on storage.objects for select to authenticated using(
  bucket_id='p2p_order_proofs' and exists(select 1 from public.p2p_coin_orders o where o.id=split_part(name,'/',1)::uuid and
  (o.buyer_id=(select auth.uid()) or o.agent_id=(select auth.uid()) or o.super_agent_id=(select auth.uid()) or (select p2p_private.current_role())='admin'))
);

commit;
