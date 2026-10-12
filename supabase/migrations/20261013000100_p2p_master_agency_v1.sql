-- JALWA P2P Master-Agency v1. Independent economy; never mutates legacy wallet tables.
begin;
create schema if not exists p2p_private;
revoke all on schema p2p_private from public,anon,authenticated;
create type public.p2p_role as enum ('admin','super_agent','sub_agent','user');
create type public.p2p_asset as enum ('coin','diamond');
create type public.p2p_withdrawal_status as enum ('pending_payment','pending_approval','completed','rejected','cancelled');
create type public.p2p_ledger_kind as enum ('coin_issue','coin_transfer','diamond_earned','diamond_lock','diamond_release','diamond_return','gift_spend','admin_adjustment');

create table public.p2p_profiles (
 user_id uuid primary key references auth.users(id) on delete restrict,
 role public.p2p_role not null default 'user',
 super_agent_id uuid references public.p2p_profiles(user_id) on delete restrict,
 display_name text, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(super_agent_id is null or super_agent_id<>user_id),
 check((role='sub_agent' and super_agent_id is not null) or (role<>'sub_agent' and super_agent_id is null))
);
create index p2p_profiles_super_agent_idx on public.p2p_profiles(super_agent_id);
create table public.p2p_wallets(
 user_id uuid primary key references public.p2p_profiles(user_id) on delete restrict,
 coin_available bigint not null default 0 check(coin_available>=0),
 diamond_available bigint not null default 0 check(diamond_available>=0),
 diamond_locked bigint not null default 0 check(diamond_locked>=0),
 updated_at timestamptz not null default now()
);
create table public.p2p_exchange_rates(
 currency_code text primary key check(currency_code ~ '^[A-Z]{3}$'),
 diamonds_per_fiat_unit numeric(20,8) not null check(diamonds_per_fiat_unit>0),
 active boolean not null default true,
 updated_by uuid references public.p2p_profiles(user_id) on delete restrict,
 updated_at timestamptz not null default now()
);
create table public.p2p_diamond_withdrawals(
 id uuid primary key default gen_random_uuid(), request_key uuid not null,
 user_id uuid not null references public.p2p_profiles(user_id) on delete restrict,
 sub_agent_id uuid not null references public.p2p_profiles(user_id) on delete restrict,
 super_agent_id uuid not null references public.p2p_profiles(user_id) on delete restrict,
 amount bigint not null check(amount>0),
 fiat_currency text not null check(fiat_currency ~ '^[A-Z]{3}$'),
 fiat_amount numeric(20,2) not null check(fiat_amount>0),
 diamond_rate numeric(20,8) not null check(diamond_rate>0),
 status public.p2p_withdrawal_status not null default 'pending_payment',
 payout_screenshot_path text, payout_reference text, sub_agent_submitted_at timestamptz,
 approved_by uuid references public.p2p_profiles(user_id) on delete restrict, approved_at timestamptz,
 rejection_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,request_key),
 check(user_id<>sub_agent_id and user_id<>super_agent_id),
 check((status='completed' and approved_by is not null and approved_at is not null) or status<>'completed')
);
create index p2p_withdrawals_super_status_idx on public.p2p_diamond_withdrawals(super_agent_id,status,created_at desc);
create index p2p_withdrawals_subagent_idx on public.p2p_diamond_withdrawals(sub_agent_id,created_at desc);
create index p2p_withdrawals_user_idx on public.p2p_diamond_withdrawals(user_id,created_at desc);
create table public.p2p_ledger(
 id uuid primary key default gen_random_uuid(), request_key uuid not null unique,
 kind public.p2p_ledger_kind not null, asset public.p2p_asset not null,
 amount bigint not null check(amount>0),
 from_user_id uuid references public.p2p_profiles(user_id) on delete restrict,
 to_user_id uuid references public.p2p_profiles(user_id) on delete restrict,
 withdrawal_id uuid references public.p2p_diamond_withdrawals(id) on delete restrict,
 actor_id uuid references public.p2p_profiles(user_id) on delete restrict,
 metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
 check(from_user_id is null or to_user_id is null or from_user_id<>to_user_id)
);
create unique index p2p_one_lock_per_withdrawal on public.p2p_ledger(withdrawal_id) where kind='diamond_lock';
create unique index p2p_one_release_per_withdrawal on public.p2p_ledger(withdrawal_id) where kind='diamond_release';
create unique index p2p_one_return_per_withdrawal on public.p2p_ledger(withdrawal_id) where kind='diamond_return';
create index p2p_ledger_from_idx on public.p2p_ledger(from_user_id,created_at desc);
create index p2p_ledger_to_idx on public.p2p_ledger(to_user_id,created_at desc);
create table public.p2p_notifications(
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references public.p2p_profiles(user_id) on delete cascade,
 withdrawal_id uuid references public.p2p_diamond_withdrawals(id) on delete cascade,
 event_type text not null,payload jsonb not null default '{}'::jsonb,
 read_at timestamptz,created_at timestamptz not null default now()
);
create index p2p_notifications_recipient_idx on public.p2p_notifications(recipient_id,created_at desc);

create or replace function p2p_private.current_role() returns public.p2p_role
language sql stable security definer set search_path=''
as $$ select p.role from public.p2p_profiles p where p.user_id=(select auth.uid()) and p.active $$;
create or replace function p2p_private.valid_agent_pair(p_sub uuid,p_super uuid) returns boolean
language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.p2p_profiles s join public.p2p_profiles m on m.user_id=s.super_agent_id
 where s.user_id=p_sub and s.role='sub_agent' and s.active and s.super_agent_id=p_super and m.role='super_agent' and m.active) $$;
grant usage on schema p2p_private to authenticated,service_role;
revoke all on function p2p_private.current_role() from public,anon;
revoke all on function p2p_private.valid_agent_pair(uuid,uuid) from public,anon;
grant execute on function p2p_private.current_role() to authenticated;
grant execute on function p2p_private.valid_agent_pair(uuid,uuid) to authenticated;

create or replace function p2p_private.make_wallet() returns trigger
language plpgsql security definer set search_path=''
as $$ begin insert into public.p2p_wallets(user_id) values(new.user_id) on conflict do nothing; return new; end $$;
revoke all on function p2p_private.make_wallet() from public,anon,authenticated;
create trigger p2p_profile_wallet after insert on public.p2p_profiles for each row execute function p2p_private.make_wallet();

create or replace function public.p2p_admin_assign_role(p_user_id uuid,p_role public.p2p_role,p_super_agent_id uuid default null,p_display_name text default null)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if (select p2p_private.current_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
 if p_role='sub_agent' then
  if p_super_agent_id is null or not exists(select 1 from public.p2p_profiles where user_id=p_super_agent_id and role='super_agent' and active)
  then raise exception 'ACTIVE_SUPER_AGENT_REQUIRED'; end if;
 elsif p_super_agent_id is not null then raise exception 'ONLY_SUB_AGENT_HAS_PARENT'; end if;
 insert into public.p2p_profiles(user_id,role,super_agent_id,display_name)
 values(p_user_id,p_role,p_super_agent_id,nullif(trim(p_display_name),''))
 on conflict(user_id) do update set role=excluded.role,super_agent_id=excluded.super_agent_id,display_name=excluded.display_name,updated_at=now();
end $$;
revoke all on function public.p2p_admin_assign_role(uuid,public.p2p_role,uuid,text) from public,anon;
grant execute on function public.p2p_admin_assign_role(uuid,public.p2p_role,uuid,text) to authenticated;

create or replace function public.p2p_admin_set_exchange_rate(p_currency_code text,p_diamonds_per_fiat_unit numeric,p_active boolean default true)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if (select p2p_private.current_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
 if p_currency_code !~ '^[A-Z]{3}$' or p_diamonds_per_fiat_unit is null or p_diamonds_per_fiat_unit<=0 then raise exception 'INVALID_RATE'; end if;
 insert into public.p2p_exchange_rates(currency_code,diamonds_per_fiat_unit,active,updated_by,updated_at)
 values(p_currency_code,p_diamonds_per_fiat_unit,p_active,auth.uid(),now())
 on conflict(currency_code) do update set diamonds_per_fiat_unit=excluded.diamonds_per_fiat_unit,active=excluded.active,updated_by=excluded.updated_by,updated_at=now();
end $$;
revoke all on function public.p2p_admin_set_exchange_rate(text,numeric,boolean) from public,anon;
grant execute on function public.p2p_admin_set_exchange_rate(text,numeric,boolean) to authenticated;

create or replace function public.p2p_admin_issue_coins(p_request_key uuid,p_amount bigint)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_id uuid;
begin
 if v_actor is null or p_request_key is null or p_amount is null or p_amount<=0 then raise exception 'INVALID_ISSUANCE'; end if;
 if (select p2p_private.current_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
 select id into v_id from public.p2p_ledger where request_key=p_request_key and actor_id=v_actor;
 if v_id is not null then return v_id; end if;
 perform 1 from public.p2p_wallets where user_id=v_actor for update;
 if not found then raise exception 'ADMIN_WALLET_NOT_FOUND'; end if;
 update public.p2p_wallets set coin_available=coin_available+p_amount,updated_at=now() where user_id=v_actor;
 insert into public.p2p_ledger(request_key,kind,asset,amount,to_user_id,actor_id,metadata)
 values(p_request_key,'coin_issue','coin',p_amount,v_actor,v_actor,jsonb_build_object('reason','admin_platform_issuance')) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.p2p_admin_issue_coins(uuid,bigint) from public,anon;
grant execute on function public.p2p_admin_issue_coins(uuid,bigint) to authenticated;

create or replace function public.p2p_request_diamond_withdrawal(p_request_key uuid,p_sub_agent_id uuid,p_amount bigint,p_fiat_currency text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_super uuid; v_id uuid; v_rate numeric(20,8); v_fiat numeric(20,2); v_old public.p2p_diamond_withdrawals%rowtype;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_request_key is null or p_amount is null or p_amount<=0 or p_fiat_currency !~ '^[A-Z]{3}$' then raise exception 'INVALID_REQUEST'; end if;
 select * into v_old from public.p2p_diamond_withdrawals where user_id=v_user and request_key=p_request_key;
 if found then return v_old.id; end if;
 if not exists(select 1 from public.p2p_profiles where user_id=v_user and role='user' and active) then raise exception 'ACTIVE_USER_REQUIRED'; end if;
 select super_agent_id into v_super from public.p2p_profiles where user_id=p_sub_agent_id and role='sub_agent' and active;
 if v_super is null or not p2p_private.valid_agent_pair(p_sub_agent_id,v_super) then raise exception 'INVALID_SUB_AGENT'; end if;
 select diamonds_per_fiat_unit into v_rate from public.p2p_exchange_rates where currency_code=p_fiat_currency and active;
 if v_rate is null then raise exception 'EXCHANGE_RATE_UNAVAILABLE'; end if;
 v_fiat:=round(p_amount::numeric/v_rate,2);
 if v_fiat<=0 then raise exception 'WITHDRAWAL_BELOW_MINIMUM_FIAT'; end if;
 perform 1 from public.p2p_wallets where user_id=v_user for update;
 if not found then raise exception 'WALLET_NOT_FOUND'; end if;
 if (select diamond_available from public.p2p_wallets where user_id=v_user)<p_amount then raise exception 'INSUFFICIENT_DIAMONDS'; end if;
 insert into public.p2p_diamond_withdrawals(request_key,user_id,sub_agent_id,super_agent_id,amount,fiat_currency,fiat_amount,diamond_rate)
 values(p_request_key,v_user,p_sub_agent_id,v_super,p_amount,p_fiat_currency,v_fiat,v_rate) returning id into v_id;
 update public.p2p_wallets set diamond_available=diamond_available-p_amount,diamond_locked=diamond_locked+p_amount,updated_at=now() where user_id=v_user;
 insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,to_user_id,withdrawal_id,actor_id)
 values(gen_random_uuid(),'diamond_lock','diamond',p_amount,v_user,p_sub_agent_id,v_id,v_user);
 return v_id;
end $$;
revoke all on function public.p2p_request_diamond_withdrawal(uuid,uuid,bigint,text) from public,anon;
grant execute on function public.p2p_request_diamond_withdrawal(uuid,uuid,bigint,text) to authenticated;

create or replace function public.p2p_submit_diamond_payout(p_withdrawal_id uuid,p_screenshot_path text,p_payout_reference text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_w public.p2p_diamond_withdrawals%rowtype;
begin
 if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into v_w from public.p2p_diamond_withdrawals where id=p_withdrawal_id for update;
 if not found or v_w.sub_agent_id<>v_actor then raise exception 'WITHDRAWAL_NOT_FOUND_OR_FORBIDDEN'; end if;
 if v_w.status<>'pending_payment' then raise exception 'NOT_AWAITING_PROOF'; end if;
 if p_screenshot_path is null or p_screenshot_path !~ ('^'||p_withdrawal_id::text||'/[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp)$') then raise exception 'INVALID_PROOF_PATH'; end if;
 if not exists(select 1 from storage.objects where bucket_id='payout_screenshots' and name=p_screenshot_path) then raise exception 'PROOF_NOT_UPLOADED'; end if;
 update public.p2p_diamond_withdrawals set status='pending_approval',payout_screenshot_path=p_screenshot_path,
 payout_reference=nullif(trim(p_payout_reference),''),sub_agent_submitted_at=now(),updated_at=now() where id=p_withdrawal_id;
 insert into public.p2p_notifications(recipient_id,withdrawal_id,event_type,payload)
 values(v_w.super_agent_id,p_withdrawal_id,'diamond_withdrawal_awaiting_approval',jsonb_build_object('amount',v_w.amount,'currency',v_w.fiat_currency));
end $$;
revoke all on function public.p2p_submit_diamond_payout(uuid,text,text) from public,anon;
grant execute on function public.p2p_submit_diamond_payout(uuid,text,text) to authenticated;

create or replace function public.p2p_approve_diamond_withdrawal(p_withdrawal_id uuid,p_request_key uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_w public.p2p_diamond_withdrawals%rowtype;
begin
 if v_actor is null or p_request_key is null then raise exception 'AUTH_AND_KEY_REQUIRED'; end if;
 select * into v_w from public.p2p_diamond_withdrawals where id=p_withdrawal_id for update;
 if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
 if v_w.super_agent_id<>v_actor or not p2p_private.valid_agent_pair(v_w.sub_agent_id,v_actor) then raise exception 'ASSIGNED_SUPER_AGENT_REQUIRED'; end if;
 if v_w.status<>'pending_approval' or v_w.payout_screenshot_path is null then raise exception 'NOT_AWAITING_APPROVAL'; end if;
 if exists(select 1 from public.p2p_ledger where withdrawal_id=v_w.id and kind='diamond_release') then raise exception 'ALREADY_SETTLED'; end if;
 perform 1 from public.p2p_wallets where user_id in (v_w.user_id,v_w.sub_agent_id) order by user_id for update;
 if (select diamond_locked from public.p2p_wallets where user_id=v_w.user_id)<v_w.amount then raise exception 'ESCROW_BALANCE_MISMATCH'; end if;
 update public.p2p_wallets set diamond_locked=diamond_locked-v_w.amount,updated_at=now() where user_id=v_w.user_id;
 update public.p2p_wallets set diamond_available=diamond_available+v_w.amount,updated_at=now() where user_id=v_w.sub_agent_id;
 update public.p2p_diamond_withdrawals set status='completed',approved_by=v_actor,approved_at=now(),updated_at=now() where id=v_w.id;
 insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,to_user_id,withdrawal_id,actor_id)
 values(p_request_key,'diamond_release','diamond',v_w.amount,v_w.user_id,v_w.sub_agent_id,v_w.id,v_actor);
 insert into public.p2p_notifications(recipient_id,withdrawal_id,event_type,payload) values
 (v_w.user_id,v_w.id,'diamond_withdrawal_approved',jsonb_build_object('amount',v_w.amount)),
 (v_w.sub_agent_id,v_w.id,'diamonds_received',jsonb_build_object('amount',v_w.amount));
end $$;
revoke all on function public.p2p_approve_diamond_withdrawal(uuid,uuid) from public,anon;
grant execute on function public.p2p_approve_diamond_withdrawal(uuid,uuid) to authenticated;

create or replace function public.p2p_reject_diamond_withdrawal(p_withdrawal_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_w public.p2p_diamond_withdrawals%rowtype;
begin
 if v_actor is null or length(trim(coalesce(p_reason,'')))<3 then raise exception 'REJECTION_REASON_REQUIRED'; end if;
 select * into v_w from public.p2p_diamond_withdrawals where id=p_withdrawal_id for update;
 if not found or v_w.super_agent_id<>v_actor or not p2p_private.valid_agent_pair(v_w.sub_agent_id,v_actor) then raise exception 'ASSIGNED_SUPER_AGENT_REQUIRED'; end if;
 if v_w.status<>'pending_approval' then raise exception 'NOT_AWAITING_APPROVAL'; end if;
 update public.p2p_wallets set diamond_locked=diamond_locked-v_w.amount,diamond_available=diamond_available+v_w.amount,updated_at=now()
 where user_id=v_w.user_id and diamond_locked>=v_w.amount;
 if not found then raise exception 'ESCROW_BALANCE_MISMATCH'; end if;
 update public.p2p_diamond_withdrawals set status='rejected',rejection_reason=left(trim(p_reason),1000),updated_at=now() where id=v_w.id;
 insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,to_user_id,withdrawal_id,actor_id,metadata)
 values(gen_random_uuid(),'diamond_return','diamond',v_w.amount,v_w.sub_agent_id,v_w.user_id,v_w.id,v_actor,jsonb_build_object('reason',left(trim(p_reason),1000)));
 insert into public.p2p_notifications(recipient_id,withdrawal_id,event_type,payload)
 values(v_w.user_id,v_w.id,'diamond_withdrawal_rejected',jsonb_build_object('reason',left(trim(p_reason),1000)));
end $$;
revoke all on function public.p2p_reject_diamond_withdrawal(uuid,text) from public,anon;
grant execute on function public.p2p_reject_diamond_withdrawal(uuid,text) to authenticated;

create or replace function public.p2p_transfer_coins(p_request_key uuid,p_to_user_id uuid,p_amount bigint)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_from_role public.p2p_role; v_to_role public.p2p_role; v_to_super uuid; v_id uuid;
begin
 if v_actor is null or p_request_key is null or p_amount is null or p_amount<=0 then raise exception 'INVALID_TRANSFER'; end if;
 select id into v_id from public.p2p_ledger where request_key=p_request_key and actor_id=v_actor;
 if v_id is not null then return v_id; end if;
 select role into v_from_role from public.p2p_profiles where user_id=v_actor and active;
 select role,super_agent_id into v_to_role,v_to_super from public.p2p_profiles where user_id=p_to_user_id and active;
 if v_from_role is null or v_to_role is null or v_actor=p_to_user_id then raise exception 'INVALID_PARTIES'; end if;
 if not ((v_from_role='admin' and v_to_role='super_agent')
   or (v_from_role='super_agent' and v_to_role='sub_agent' and v_to_super=v_actor)
   or (v_from_role='sub_agent' and v_to_role='user' and exists(select 1 from public.p2p_profiles s where s.user_id=v_actor and s.role='sub_agent' and s.active)))
 then raise exception 'HIERARCHY_TRANSFER_FORBIDDEN'; end if;
 perform 1 from public.p2p_wallets where user_id in (v_actor,p_to_user_id) order by user_id for update;
 update public.p2p_wallets set coin_available=coin_available-p_amount,updated_at=now() where user_id=v_actor and coin_available>=p_amount;
 if not found then raise exception 'INSUFFICIENT_COINS'; end if;
 update public.p2p_wallets set coin_available=coin_available+p_amount,updated_at=now() where user_id=p_to_user_id;
 insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,to_user_id,actor_id)
 values(p_request_key,'coin_transfer','coin',p_amount,v_actor,p_to_user_id,v_actor) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.p2p_transfer_coins(uuid,uuid,bigint) from public,anon;
grant execute on function public.p2p_transfer_coins(uuid,uuid,bigint) to authenticated;

create or replace function p2p_private.credit_diamonds(p_request_key uuid,p_user_id uuid,p_amount bigint,p_source text)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if p_request_key is null or p_amount is null or p_amount<=0 then raise exception 'INVALID_CREDIT'; end if;
 if exists(select 1 from public.p2p_ledger where request_key=p_request_key) then return; end if;
 perform 1 from public.p2p_wallets where user_id=p_user_id for update;
 if not found then raise exception 'WALLET_NOT_FOUND'; end if;
 update public.p2p_wallets set diamond_available=diamond_available+p_amount,updated_at=now() where user_id=p_user_id;
 insert into public.p2p_ledger(request_key,kind,asset,amount,to_user_id,metadata)
 values(p_request_key,'diamond_earned','diamond',p_amount,p_user_id,jsonb_build_object('source',p_source));
end $$;
revoke all on function p2p_private.credit_diamonds(uuid,uuid,bigint,text) from public,anon,authenticated;
grant execute on function p2p_private.credit_diamonds(uuid,uuid,bigint,text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payout_screenshots','payout_screenshots',false,5242880,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
create policy p2p_proof_upload_pending_subagent on storage.objects for insert to authenticated with check(
 bucket_id='payout_screenshots' and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
 and exists(select 1 from public.p2p_diamond_withdrawals w where w.id::text=(storage.foldername(name))[1]
 and w.sub_agent_id=(select auth.uid()) and w.status='pending_payment'));
create policy p2p_proof_read_parties on storage.objects for select to authenticated using(
 bucket_id='payout_screenshots' and exists(select 1 from public.p2p_diamond_withdrawals w
 where w.id::text=(storage.foldername(name))[1] and (w.user_id=(select auth.uid()) or w.sub_agent_id=(select auth.uid()) or w.super_agent_id=(select auth.uid()))));

alter table public.p2p_profiles enable row level security;
alter table public.p2p_wallets enable row level security;
alter table public.p2p_exchange_rates enable row level security;
alter table public.p2p_diamond_withdrawals enable row level security;
alter table public.p2p_ledger enable row level security;
alter table public.p2p_notifications enable row level security;
create policy p2p_exchange_rates_read_active on public.p2p_exchange_rates for select to authenticated using(active);
create policy p2p_profiles_read_related on public.p2p_profiles for select to authenticated using(
 user_id=(select auth.uid()) or super_agent_id=(select auth.uid()) or p2p_private.valid_agent_pair(user_id,(select auth.uid())));
create policy p2p_wallet_read_own on public.p2p_wallets for select to authenticated using(user_id=(select auth.uid()));
create policy p2p_withdrawals_read_parties on public.p2p_diamond_withdrawals for select to authenticated using(
 user_id=(select auth.uid()) or sub_agent_id=(select auth.uid()) or super_agent_id=(select auth.uid()) or (select p2p_private.current_role())='admin');
create policy p2p_ledger_read_parties on public.p2p_ledger for select to authenticated using(
 from_user_id=(select auth.uid()) or to_user_id=(select auth.uid()) or (select p2p_private.current_role())='admin');
create policy p2p_notifications_read_own on public.p2p_notifications for select to authenticated using(recipient_id=(select auth.uid()));
create policy p2p_notifications_mark_read on public.p2p_notifications for update to authenticated using(recipient_id=(select auth.uid())) with check(recipient_id=(select auth.uid()));
revoke all on public.p2p_exchange_rates,public.p2p_profiles,public.p2p_wallets,public.p2p_diamond_withdrawals,public.p2p_ledger,public.p2p_notifications from anon,authenticated;
grant select on public.p2p_exchange_rates,public.p2p_profiles,public.p2p_wallets,public.p2p_diamond_withdrawals,public.p2p_ledger,public.p2p_notifications to authenticated;
grant update(read_at) on public.p2p_notifications to authenticated;
commit;
