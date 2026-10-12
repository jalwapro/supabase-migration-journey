-- JALWA P2P coin trading: private agent payment details, atomic escrow and audited resolution.
create extension if not exists pgcrypto;

create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  base_fiat_amount numeric(12,2) not null default 50 check (base_fiat_amount > 0),
  base_coin_amount numeric(20,2) not null default 500 check (base_coin_amount > 0),
  min_agent_coins numeric(20,2) not null default 500 check (min_agent_coins > 0),
  max_agent_coins numeric(20,2) not null default 600 check (max_agent_coins >= min_agent_coins),
  min_buy_margin_percent numeric(5,2) not null default 0 check (min_buy_margin_percent between 0 and 100),
  max_buy_margin_percent numeric(5,2) not null default 30 check (max_buy_margin_percent between 0 and 100),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.system_settings (base_fiat_amount,base_coin_amount,min_agent_coins,max_agent_coins)
select 50,500,500,600 where not exists (select 1 from public.system_settings);

create table if not exists public.agent_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency_code varchar(10) not null default 'PKR',
  country varchar(50) not null default 'Pakistan',
  payment_methods jsonb not null default '{}'::jsonb check (jsonb_typeof(payment_methods) = 'object'),
  sell_rate numeric(20,2) not null default 500 check (sell_rate > 0),
  buy_rate numeric(20,2) not null default 400 check (buy_rate > 0),
  whatsapp_number varchar(20),
  pending_whatsapp varchar(20),
  is_active boolean not null default false,
  is_banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_profiles_market_idx on public.agent_profiles(country,is_active,is_banned);

do $$ begin
  create type public.p2p_status as enum ('pending','paid','appealed','completed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.p2p_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete restrict,
  agent_id uuid not null references public.agent_profiles(user_id) on delete restrict,
  coin_amount numeric(20,2) not null check (coin_amount > 0 and coin_amount = trunc(coin_amount)),
  fiat_amount numeric(12,2) not null check (fiat_amount > 0),
  currency varchar(10) not null,
  status public.p2p_status not null default 'pending',
  payment_proof_url text,
  buyer_marked_paid_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  appealed_at timestamptz,
  resolution_note text,
  resolved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> agent_id)
);
create index if not exists p2p_orders_buyer_idx on public.p2p_orders(buyer_id,created_at desc);
create index if not exists p2p_orders_agent_idx on public.p2p_orders(agent_id,created_at desc);
create index if not exists p2p_orders_status_idx on public.p2p_orders(status,created_at desc);

create table if not exists public.p2p_ledger (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.p2p_orders(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  entry_type text not null check (entry_type in ('escrow_lock','escrow_release','escrow_refund','admin_adjustment')),
  coin_delta numeric(20,2) not null,
  balance_after numeric(20,2),
  note text not null,
  created_at timestamptz not null default now()
);
create index if not exists p2p_ledger_order_idx on public.p2p_ledger(order_id,created_at);

alter table public.system_settings enable row level security;
alter table public.agent_profiles enable row level security;
alter table public.p2p_orders enable row level security;
alter table public.p2p_ledger enable row level security;

drop policy if exists p2p_settings_admin_read on public.system_settings;
create policy p2p_settings_admin_read on public.system_settings for select to authenticated using (public.is_admin((select auth.uid())));
drop policy if exists p2p_settings_admin_update on public.system_settings;
create policy p2p_settings_admin_update on public.system_settings for update to authenticated using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

drop policy if exists p2p_agent_owner_read on public.agent_profiles;
create policy p2p_agent_owner_read on public.agent_profiles for select to authenticated using (user_id = (select auth.uid()) or public.is_admin((select auth.uid())));
drop policy if exists p2p_agent_owner_insert on public.agent_profiles;
create policy p2p_agent_owner_insert on public.agent_profiles for insert to authenticated with check (user_id = (select auth.uid()) and is_banned = false and is_active = false);
drop policy if exists p2p_agent_owner_update on public.agent_profiles;
create policy p2p_agent_owner_update on public.agent_profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and is_banned = false);
drop policy if exists p2p_agent_admin_manage on public.agent_profiles;
create policy p2p_agent_admin_manage on public.agent_profiles for all to authenticated using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

drop policy if exists p2p_orders_participant_read on public.p2p_orders;
create policy p2p_orders_participant_read on public.p2p_orders for select to authenticated using (buyer_id = (select auth.uid()) or agent_id = (select auth.uid()) or public.is_admin((select auth.uid())));
-- Orders are created and transitioned only through the server-side escrow function.
drop policy if exists p2p_orders_no_client_insert on public.p2p_orders;
create policy p2p_orders_no_client_insert on public.p2p_orders for insert to authenticated with check (false);
drop policy if exists p2p_orders_no_client_update on public.p2p_orders;
create policy p2p_orders_no_client_update on public.p2p_orders for update to authenticated using (false) with check (false);
drop policy if exists p2p_orders_no_client_delete on public.p2p_orders;
create policy p2p_orders_no_client_delete on public.p2p_orders for delete to authenticated using (false);

drop policy if exists p2p_ledger_participant_read on public.p2p_ledger;
create policy p2p_ledger_participant_read on public.p2p_ledger for select to authenticated using (
  public.is_admin((select auth.uid())) or exists (
    select 1 from public.p2p_orders o where o.id = order_id and (o.buyer_id = (select auth.uid()) or o.agent_id = (select auth.uid()))
  )
);
drop policy if exists p2p_ledger_no_client_write on public.p2p_ledger;
create policy p2p_ledger_no_client_write on public.p2p_ledger for all to authenticated using (false) with check (false);

revoke all on public.system_settings, public.agent_profiles, public.p2p_orders, public.p2p_ledger from anon, authenticated;
grant select on public.p2p_orders, public.p2p_ledger to authenticated;
grant all on public.system_settings, public.agent_profiles, public.p2p_orders, public.p2p_ledger to service_role;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('p2p-payment-proofs','p2p-payment-proofs',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=false, file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists p2p_proof_upload_own_folder on storage.objects;
create policy p2p_proof_upload_own_folder on storage.objects for insert to authenticated with check (
  bucket_id = 'p2p-payment-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists p2p_proof_read_participants on storage.objects;
create policy p2p_proof_read_participants on storage.objects for select to authenticated using (
  bucket_id = 'p2p-payment-proofs' and (
    (storage.foldername(name))[1] = (select auth.uid())::text or exists (
      select 1 from public.p2p_orders o
      where o.id::text = (storage.foldername(name))[2]
        and (o.buyer_id = (select auth.uid()) or o.agent_id = (select auth.uid()) or public.is_admin((select auth.uid())))
    )
  )
);

-- Service-role-only transactional API. The Edge Function verifies the caller's JWT before passing actor_id.
create or replace function public.p2p_escrow_action(actor_id uuid, action text, payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.system_settings%rowtype;
  v_agent public.agent_profiles%rowtype;
  v_order public.p2p_orders%rowtype;
  v_buyer_balance bigint;
  v_agent_balance bigint;
  v_amount numeric(20,2);
  v_fiat numeric(12,2);
  v_rate numeric(20,2);
  v_margin numeric(8,2);
  v_result jsonb;
  v_order_id uuid;
  v_admin boolean := false;
  v_methods jsonb;
  v_country text;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  v_admin := public.is_admin(actor_id);
  select * into v_settings from public.system_settings order by updated_at desc limit 1;
  if not found then raise exception 'P2P_SETTINGS_MISSING'; end if;

  if action = 'GET_ORDER' then
    v_order_id := nullif(payload->>'order_id','')::uuid;
    select * into v_order from public.p2p_orders where id=v_order_id;
    if not found then raise exception 'ORDER_NOT_FOUND'; end if;
    if actor_id not in (v_order.buyer_id,v_order.agent_id) and not v_admin then raise exception 'NOT_ORDER_PARTICIPANT'; end if;
    select * into v_agent from public.agent_profiles where user_id=v_order.agent_id;
    return jsonb_build_object('order',to_jsonb(v_order),'agent',jsonb_build_object(
      'user_id',v_agent.user_id,'currency_code',v_agent.currency_code,'country',v_agent.country,
      'payment_methods',v_agent.payment_methods,'whatsapp_number',v_agent.whatsapp_number
    ));
  elsif action = 'MARKETPLACE' then
    v_country := nullif(trim(payload->>'country'),'');
    return coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',a.user_id,'currency_code',a.currency_code,'country',a.country,
        'sell_rate',a.sell_rate,'buy_rate',a.buy_rate,'base_fiat_amount',v_settings.base_fiat_amount,
        'payment_methods',coalesce((select jsonb_agg(key) from jsonb_object_keys(a.payment_methods) as method(key) where coalesce(a.payment_methods->>method.key,'') <> ''),'[]'::jsonb)
      ) order by a.sell_rate desc)
      from public.agent_profiles a
      where a.is_active and not a.is_banned and a.sell_rate between v_settings.min_agent_coins and v_settings.max_agent_coins
        and (v_country is null or lower(a.country)=lower(v_country))
    ), '[]'::jsonb);
  elsif action = 'GET_AGENT' then
    select * into v_agent from public.agent_profiles where user_id=actor_id;
    if not found then return jsonb_build_object('agent',null,'settings',to_jsonb(v_settings)); end if;
    return jsonb_build_object('agent',to_jsonb(v_agent),'settings',to_jsonb(v_settings));
  elsif action = 'SAVE_AGENT_PROFILE' then
    v_rate := nullif(payload->>'sell_rate','')::numeric;
    v_amount := nullif(payload->>'buy_rate','')::numeric;
    v_methods := coalesce(payload->'payment_methods','{}'::jsonb);
    if jsonb_typeof(v_methods) <> 'object' or jsonb_object_length(v_methods)=0 then raise exception 'INVALID_PAYMENT_METHODS'; end if;
    if not exists (select 1 from jsonb_each_text(v_methods) kv where length(trim(kv.value))>0) then raise exception 'ADD_AT_LEAST_ONE_PAYMENT_METHOD'; end if;
    if v_rate is null or v_rate <> trunc(v_rate) or v_rate < v_settings.min_agent_coins or v_rate > v_settings.max_agent_coins then raise exception 'SELL_RATE_OUT_OF_RANGE:%:%',v_settings.min_agent_coins,v_settings.max_agent_coins; end if;
    if v_amount is null or v_amount <> trunc(v_amount) or v_amount <= 0 or v_amount >= v_rate then raise exception 'INVALID_BUY_RATE'; end if;
    v_margin := ((v_rate-v_amount)/v_rate)*100;
    if v_margin < v_settings.min_buy_margin_percent or v_margin > v_settings.max_buy_margin_percent then raise exception 'BUY_MARGIN_OUT_OF_RANGE:%:%',v_settings.min_buy_margin_percent,v_settings.max_buy_margin_percent; end if;
    if length(coalesce(payload->>'country','')) > 50 or length(coalesce(payload->>'currency_code','PKR')) > 10 then raise exception 'INVALID_COUNTRY_OR_CURRENCY'; end if;
    insert into public.agent_profiles(user_id,currency_code,country,payment_methods,sell_rate,buy_rate,is_active,is_banned)
    values(actor_id,upper(coalesce(nullif(payload->>'currency_code',''),'PKR')),coalesce(nullif(trim(payload->>'country'),''),'Pakistan'),v_methods,v_rate,v_amount,coalesce((payload->>'is_active')::boolean,false),false)
    on conflict(user_id) do update set
      currency_code=excluded.currency_code,country=excluded.country,payment_methods=excluded.payment_methods,
      sell_rate=excluded.sell_rate,buy_rate=excluded.buy_rate,
      is_active=case when public.agent_profiles.is_banned then false else excluded.is_active end,
      updated_at=now()
    where not public.agent_profiles.is_banned
    returning * into v_agent;
    if not found then raise exception 'AGENT_BANNED'; end if;
    return jsonb_build_object('agent',to_jsonb(v_agent),'settings',to_jsonb(v_settings));
  elsif action = 'REQUEST_WHATSAPP' then
    if length(coalesce(payload->>'whatsapp_number','')) < 7 or length(payload->>'whatsapp_number') > 20 then raise exception 'INVALID_WHATSAPP'; end if;
    update public.agent_profiles set pending_whatsapp=trim(payload->>'whatsapp_number'),updated_at=now()
      where user_id=actor_id and not is_banned returning * into v_agent;
    if not found then raise exception 'AGENT_PROFILE_REQUIRED_OR_BANNED'; end if;
    return jsonb_build_object('agent',to_jsonb(v_agent));
  elsif action = 'CREATE_ORDER' then
    v_order_id := nullif(payload->>'agent_id','')::uuid;
    v_amount := nullif(payload->>'coin_amount','')::numeric;
    if v_order_id is null or v_amount is null or v_amount <= 0 then raise exception 'INVALID_ORDER'; end if;
    if v_amount <> trunc(v_amount) then raise exception 'COIN_AMOUNT_MUST_BE_WHOLE_NUMBER'; end if;
    if v_amount > 10000000 then raise exception 'ORDER_LIMIT_EXCEEDED'; end if;
    select * into v_agent from public.agent_profiles where user_id=v_order_id for update;
    if not found or not v_agent.is_active or v_agent.is_banned then raise exception 'AGENT_NOT_AVAILABLE'; end if;
    if actor_id=v_agent.user_id then raise exception 'CANNOT_BUY_FROM_SELF'; end if;
    if v_agent.sell_rate < v_settings.min_agent_coins or v_agent.sell_rate > v_settings.max_agent_coins then raise exception 'AGENT_RATE_OUT_OF_RANGE'; end if;
    if mod(v_amount, v_agent.sell_rate) <> 0 then raise exception 'ORDER_MUST_BE_A_MULTIPLE_OF_LISTING_RATE:%',v_agent.sell_rate; end if;
    v_fiat := round((v_amount / v_agent.sell_rate) * v_settings.base_fiat_amount,2);
    perform set_config('app.trusted_definer','on',true);
    update public.profiles set coins=coins-v_amount,updated_at=now() where id=v_agent.user_id and coins>=v_amount returning coins into v_agent_balance;
    if not found then raise exception 'AGENT_INSUFFICIENT_COINS'; end if;
    insert into public.p2p_orders(buyer_id,agent_id,coin_amount,fiat_amount,currency,status)
    values(actor_id,v_agent.user_id,v_amount,v_fiat,v_agent.currency_code,'pending') returning * into v_order;
    insert into public.p2p_ledger(order_id,user_id,entry_type,coin_delta,balance_after,note)
    values(v_order.id,v_agent.user_id,'escrow_lock',-v_amount,v_agent_balance,'Coins locked for P2P escrow order');
    return jsonb_build_object('order',to_jsonb(v_order));
  elsif action in ('BUYER_PAID','APPEAL','RELEASE_ORDER','CANCEL_ORDER','ADMIN_COMPLETE','ADMIN_CANCEL','ADMIN_APPROVE_WHATSAPP','ADMIN_BAN_AGENT','ADMIN_SAVE_SETTINGS','ADMIN_OVERVIEW') then
    if action = 'ADMIN_OVERVIEW' then
      if not v_admin then raise exception 'ADMIN_REQUIRED'; end if;
      return jsonb_build_object(
        'orders',(select coalesce(jsonb_agg(to_jsonb(o) order by o.created_at desc),'[]'::jsonb) from public.p2p_orders o where o.status in ('appealed','paid','pending')),
        'agents',(select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]'::jsonb) from public.agent_profiles a where a.is_active or a.pending_whatsapp is not null or a.is_banned),
        'settings',to_jsonb(v_settings)
      );
    end if;
    if action = 'ADMIN_APPROVE_WHATSAPP' then
      if not v_admin then raise exception 'ADMIN_REQUIRED'; end if;
      update public.agent_profiles set whatsapp_number=pending_whatsapp,pending_whatsapp=null,updated_at=now()
       where user_id=(payload->>'agent_id')::uuid and pending_whatsapp is not null returning * into v_agent;
      if not found then raise exception 'WHATSAPP_REQUEST_NOT_FOUND'; end if;
      return jsonb_build_object('agent',to_jsonb(v_agent));
    elsif action = 'ADMIN_BAN_AGENT' then
      if not v_admin then raise exception 'ADMIN_REQUIRED'; end if;
      update public.agent_profiles set is_banned=coalesce((payload->>'is_banned')::boolean,true),is_active=false,updated_at=now()
       where user_id=(payload->>'agent_id')::uuid returning * into v_agent;
      if not found then raise exception 'AGENT_NOT_FOUND'; end if;
      return jsonb_build_object('agent',to_jsonb(v_agent));
    elsif action = 'ADMIN_SAVE_SETTINGS' then
      if not v_admin then raise exception 'ADMIN_REQUIRED'; end if;
      update public.system_settings set
        base_fiat_amount=(payload->>'base_fiat_amount')::numeric,
        base_coin_amount=(payload->>'base_coin_amount')::numeric,
        min_agent_coins=(payload->>'min_agent_coins')::numeric,
        max_agent_coins=(payload->>'max_agent_coins')::numeric,
        min_buy_margin_percent=(payload->>'min_buy_margin_percent')::numeric,
        max_buy_margin_percent=(payload->>'max_buy_margin_percent')::numeric,
        updated_at=now(),updated_by=actor_id
      where id=v_settings.id
      and (payload->>'base_fiat_amount')::numeric>0
      and (payload->>'base_coin_amount')::numeric>0
      and (payload->>'min_agent_coins')::numeric>0
      and (payload->>'max_agent_coins')::numeric >= (payload->>'min_agent_coins')::numeric
      and (payload->>'min_buy_margin_percent')::numeric between 0 and 100
      and (payload->>'max_buy_margin_percent')::numeric between (payload->>'min_buy_margin_percent')::numeric and 100
      returning * into v_settings;
      if not found then raise exception 'INVALID_SETTINGS'; end if;
      return jsonb_build_object('settings',to_jsonb(v_settings));
    end if;

    v_order_id := nullif(payload->>'order_id','')::uuid;
    select * into v_order from public.p2p_orders where id=v_order_id for update;
    if not found then raise exception 'ORDER_NOT_FOUND'; end if;
    if action in ('BUYER_PAID','APPEAL','RELEASE_ORDER','CANCEL_ORDER') and actor_id not in (v_order.buyer_id,v_order.agent_id) then raise exception 'NOT_ORDER_PARTICIPANT'; end if;
    if action = 'BUYER_PAID' then
      if actor_id <> v_order.buyer_id or v_order.status <> 'pending' then raise exception 'INVALID_ORDER_TRANSITION'; end if;
      if coalesce(payload->>'payment_proof_url','') = '' then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;
      if (payload->>'payment_proof_url') !~ ('^' || actor_id::text || '/' || v_order.id::text || '/[^/]+
      update public.p2p_orders set status='paid',payment_proof_url=payload->>'payment_proof_url',buyer_marked_paid_at=now(),updated_at=now() where id=v_order.id returning * into v_order;
    elsif action = 'APPEAL' then
      if v_order.status not in ('pending','paid') then raise exception 'INVALID_ORDER_TRANSITION'; end if;
      update public.p2p_orders set status='appealed',appealed_at=now(),resolution_note=left(coalesce(payload->>'reason','Appeal opened'),1000),updated_at=now() where id=v_order.id returning * into v_order;
    elsif action = 'RELEASE_ORDER' then
      if actor_id <> v_order.agent_id or v_order.status <> 'paid' then raise exception 'ONLY_AGENT_CAN_RELEASE_PAID_ORDER'; end if;
      perform set_config('app.trusted_definer','on',true);
      update public.profiles set coins=coins+v_order.coin_amount,updated_at=now() where id=v_order.buyer_id returning coins into v_buyer_balance;
      if not found then raise exception 'BUYER_PROFILE_NOT_FOUND'; end if;
      update public.p2p_orders set status='completed',completed_at=now(),updated_at=now() where id=v_order.id returning * into v_order;
      insert into public.p2p_ledger(order_id,user_id,entry_type,coin_delta,balance_after,note)
      values(v_order.id,v_order.buyer_id,'escrow_release',v_order.coin_amount,v_buyer_balance,'Escrow released to buyer');
    elsif action = 'CANCEL_ORDER' or action = 'ADMIN_CANCEL' then
      if action='ADMIN_CANCEL' and not v_admin then raise exception 'ADMIN_REQUIRED'; end if;
      if action='CANCEL_ORDER' and (actor_id not in (v_order.buyer_id,v_order.agent_id) or v_order.status <> 'pending') then raise exception 'ONLY_PENDING_ORDER_CAN_BE_CANCELLED'; end if;
      if action='ADMIN_CANCEL' and v_order.status in ('completed','cancelled') then raise exception 'ORDER_ALREADY_CLOSED'; end if;
      perform set_config('app.trusted_definer','on',true);
      update public.profiles set coins=coins+v_order.coin_amount,updated_at=now() where id=v_order.agent_id returning coins into v_agent_balance;
      if not found then raise exception 'AGENT_PROFILE_NOT_FOUND'; end if;
      update public.p2p_orders set status='cancelled',cancelled_at=now(),resolved_by=case when action='ADMIN_CANCEL' then actor_id else null end,resolution_note=coalesce(payload->>'reason',resolution_note),updated_at=now() where id=v_order.id returning * into v_order;
      insert into public.p2p_ledger(order_id,user_id,entry_type,coin_delta,balance_after,note)
      values(v_order.id,v_order.agent_id,'escrow_refund',v_order.coin_amount,v_agent_balance,'Escrow refunded to agent');
    elsif action = 'ADMIN_COMPLETE' then
      if not v_admin then raise exception 'ADMIN_REQUIRED'; end if;
      if v_order.status not in ('appealed','paid') then raise exception 'ORDER_NOT_RESOLVABLE'; end if;
      perform set_config('app.trusted_definer','on',true);
      update public.profiles set coins=coins+v_order.coin_amount,updated_at=now() where id=v_order.buyer_id returning coins into v_buyer_balance;
      if not found then raise exception 'BUYER_PROFILE_NOT_FOUND'; end if;
      update public.p2p_orders set status='completed',completed_at=now(),resolved_by=actor_id,resolution_note=coalesce(payload->>'reason','Admin resolved in buyer favour'),updated_at=now() where id=v_order.id returning * into v_order;
      insert into public.p2p_ledger(order_id,user_id,entry_type,coin_delta,balance_after,note)
      values(v_order.id,v_order.buyer_id,'escrow_release',v_order.coin_amount,v_buyer_balance,'Admin resolved escrow to buyer');
    end if;
    return jsonb_build_object('order',to_jsonb(v_order));
  end if;
  raise exception 'INVALID_ACTION';
end;
$$;

revoke all on function public.p2p_escrow_action(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.p2p_escrow_action(uuid,text,jsonb) to service_role;
) then raise exception 'INVALID_PAYMENT_PROOF_PATH'; end if;
      update public.p2p_orders set status='paid',payment_proof_url=payload->>'payment_proof_url',buyer_marked_paid_at=now(),updated_at=now() where id=v_order.id returning * into v_order;
    elsif action = 'APPEAL' then
      if v_order.status not in ('pending','paid') then raise exception 'INVALID_ORDER_TRANSITION'; end if;
      update public.p2p_orders set status='appealed',appealed_at=now(),resolution_note=left(coalesce(payload->>'reason','Appeal opened'),1000),updated_at=now() where id=v_order.id returning * into v_order;
    elsif action = 'RELEASE_ORDER' then
      if actor_id <> v_order.agent_id or v_order.status <> 'paid' then raise exception 'ONLY_AGENT_CAN_RELEASE_PAID_ORDER'; end if;
      perform set_config('app.trusted_definer','on',true);
      update public.profiles set coins=coins+v_order.coin_amount,updated_at=now() where id=v_order.buyer_id returning coins into v_buyer_balance;
      if not found then raise exception 'BUYER_PROFILE_NOT_FOUND'; end if;
      update public.p2p_orders set status='completed',completed_at=now(),updated_at=now() where id=v_order.id returning * into v_order;
      insert into public.p2p_ledger(order_id,user_id,entry_type,coin_delta,balance_after,note)
      values(v_order.id,v_order.buyer_id,'escrow_release',v_order.coin_amount,v_buyer_balance,'Escrow released to buyer');
    elsif action = 'CANCEL_ORDER' or action = 'ADMIN_CANCEL' then
      if action='ADMIN_CANCEL' and not v_admin then raise exception 'ADMIN_REQUIRED'; end if;
      if action='CANCEL_ORDER' and (actor_id not in (v_order.buyer_id,v_order.agent_id) or v_order.status <> 'pending') then raise exception 'ONLY_PENDING_ORDER_CAN_BE_CANCELLED'; end if;
      if action='ADMIN_CANCEL' and v_order.status in ('completed','cancelled') then raise exception 'ORDER_ALREADY_CLOSED'; end if;
      perform set_config('app.trusted_definer','on',true);
      update public.profiles set coins=coins+v_order.coin_amount,updated_at=now() where id=v_order.agent_id returning coins into v_agent_balance;
      if not found then raise exception 'AGENT_PROFILE_NOT_FOUND'; end if;
      update public.p2p_orders set status='cancelled',cancelled_at=now(),resolved_by=case when action='ADMIN_CANCEL' then actor_id else null end,resolution_note=coalesce(payload->>'reason',resolution_note),updated_at=now() where id=v_order.id returning * into v_order;
      insert into public.p2p_ledger(order_id,user_id,entry_type,coin_delta,balance_after,note)
      values(v_order.id,v_order.agent_id,'escrow_refund',v_order.coin_amount,v_agent_balance,'Escrow refunded to agent');
    elsif action = 'ADMIN_COMPLETE' then
      if not v_admin then raise exception 'ADMIN_REQUIRED'; end if;
      if v_order.status not in ('appealed','paid') then raise exception 'ORDER_NOT_RESOLVABLE'; end if;
      perform set_config('app.trusted_definer','on',true);
      update public.profiles set coins=coins+v_order.coin_amount,updated_at=now() where id=v_order.buyer_id returning coins into v_buyer_balance;
      if not found then raise exception 'BUYER_PROFILE_NOT_FOUND'; end if;
      update public.p2p_orders set status='completed',completed_at=now(),resolved_by=actor_id,resolution_note=coalesce(payload->>'reason','Admin resolved in buyer favour'),updated_at=now() where id=v_order.id returning * into v_order;
      insert into public.p2p_ledger(order_id,user_id,entry_type,coin_delta,balance_after,note)
      values(v_order.id,v_order.buyer_id,'escrow_release',v_order.coin_amount,v_buyer_balance,'Admin resolved escrow to buyer');
    end if;
    return jsonb_build_object('order',to_jsonb(v_order));
  end if;
  raise exception 'INVALID_ACTION';
end;
$$;

revoke all on function public.p2p_escrow_action(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.p2p_escrow_action(uuid,text,jsonb) to service_role;
