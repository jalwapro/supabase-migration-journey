-- Diamond settlement between Sub-Agent -> Super Agent -> Admin.
-- Diamonds remain escrowed until the receiving party approves; rejects refund the sender.
begin;

create table public.p2p_agent_settlements (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  from_user_id uuid not null references public.p2p_profiles(user_id) on delete restrict,
  to_user_id uuid not null references public.p2p_profiles(user_id) on delete restrict,
  settlement_type text not null check(settlement_type in ('cash','coins')),
  diamond_amount bigint not null check(diamond_amount>0),
  coin_amount bigint,
  fiat_currency text check(fiat_currency is null or fiat_currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending_approval' check(status in ('pending_approval','approved','rejected')),
  approved_by uuid references public.p2p_profiles(user_id) on delete restrict,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(from_user_id<>to_user_id),
  check((settlement_type='coins' and coin_amount is not null and coin_amount>0) or (settlement_type='cash' and (coin_amount is null or coin_amount=0))),
  check((status='approved' and approved_by is not null and approved_at is not null) or status<>'approved')
);
create index p2p_agent_settlements_sender_idx on public.p2p_agent_settlements(from_user_id,created_at desc);
create index p2p_agent_settlements_receiver_idx on public.p2p_agent_settlements(to_user_id,status,created_at desc);
alter table public.p2p_agent_settlements enable row level security;
create policy p2p_agent_settlements_party_read on public.p2p_agent_settlements
for select to authenticated using(from_user_id=(select auth.uid()) or to_user_id=(select auth.uid()) or (select p2p_private.current_role())='admin');
alter table public.p2p_ledger add column if not exists settlement_id uuid references public.p2p_agent_settlements(id) on delete restrict;
create index if not exists p2p_ledger_settlement_idx on public.p2p_ledger(settlement_id) where settlement_id is not null;

create or replace function public.p2p_request_agent_settlement(
  p_request_key uuid,p_diamond_amount bigint,p_settlement_type text,
  p_coin_amount bigint default null,p_fiat_currency text default null,p_admin_recipient_id uuid default null
) returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_role public.p2p_role;
  v_parent uuid;
  v_recipient uuid;
  v_id uuid;
  v_old public.p2p_agent_settlements%rowtype;
begin
  if v_actor is null or p_request_key is null or p_diamond_amount is null or p_diamond_amount<=0 then raise exception 'INVALID_SETTLEMENT_REQUEST'; end if;
  if p_settlement_type not in ('cash','coins') then raise exception 'INVALID_SETTLEMENT_TYPE'; end if;
  if p_settlement_type='coins' and (p_coin_amount is null or p_coin_amount<=0) then raise exception 'COIN_AMOUNT_REQUIRED'; end if;
  if p_settlement_type='cash' and coalesce(p_coin_amount,0)<>0 then raise exception 'CASH_SETTLEMENT_CANNOT_INCLUDE_COINS'; end if;
  if p_fiat_currency is not null and p_fiat_currency !~ '^[A-Z]{3}$' then raise exception 'INVALID_FIAT_CURRENCY'; end if;
  select * into v_old from public.p2p_agent_settlements where request_key=p_request_key;
  if found then
    if v_old.from_user_id=v_actor then return v_old.id; end if;
    raise exception 'IDEMPOTENCY_KEY_REUSED';
  end if;
  select role,super_agent_id into v_role,v_parent from public.p2p_profiles where user_id=v_actor and active;
  if v_role='sub_agent' then
    v_recipient:=v_parent;
    if v_recipient is null or not exists(select 1 from public.p2p_profiles where user_id=v_recipient and role='super_agent' and active) then raise exception 'ACTIVE_PARENT_SUPER_AGENT_REQUIRED'; end if;
  elsif v_role='super_agent' then
    v_recipient:=p_admin_recipient_id;
    if v_recipient is null or not exists(select 1 from public.p2p_profiles where user_id=v_recipient and role='admin' and active) then raise exception 'ACTIVE_ADMIN_RECIPIENT_REQUIRED'; end if;
  else
    raise exception 'AGENT_ROLE_REQUIRED';
  end if;
  if v_recipient=v_actor then raise exception 'INVALID_SETTLEMENT_PARTIES'; end if;
  perform 1 from public.p2p_wallets where user_id=v_actor for update;
  update public.p2p_wallets set diamond_available=diamond_available-p_diamond_amount,diamond_locked=diamond_locked+p_diamond_amount,updated_at=now()
    where user_id=v_actor and diamond_available>=p_diamond_amount;
  if not found then raise exception 'INSUFFICIENT_DIAMONDS'; end if;
  insert into public.p2p_agent_settlements(request_key,from_user_id,to_user_id,settlement_type,diamond_amount,coin_amount,fiat_currency)
  values(p_request_key,v_actor,v_recipient,p_settlement_type,p_diamond_amount,nullif(p_coin_amount,0),p_fiat_currency)
  returning id into v_id;
  insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,to_user_id,actor_id,metadata,settlement_id)
  values(p_request_key,'agent_settlement','diamond',p_diamond_amount,v_actor,v_recipient,v_actor,
    jsonb_build_object('stage','locked','settlement_type',p_settlement_type,'coin_amount',nullif(p_coin_amount,0),'fiat_currency',p_fiat_currency),v_id);
  insert into public.p2p_notifications(recipient_id,event_type,payload)
  values(v_recipient,'agent_settlement_pending',jsonb_build_object('settlement_id',v_id,'from_user_id',v_actor,'diamond_amount',p_diamond_amount,'settlement_type',p_settlement_type));
  return v_id;
end $$;
revoke all on function public.p2p_request_agent_settlement(uuid,bigint,text,bigint,text,uuid) from public,anon;
grant execute on function public.p2p_request_agent_settlement(uuid,bigint,text,bigint,text,uuid) to authenticated;

create or replace function public.p2p_approve_agent_settlement(p_settlement_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_s public.p2p_agent_settlements%rowtype;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_s from public.p2p_agent_settlements where id=p_settlement_id for update;
  if not found or v_s.to_user_id<>v_actor then raise exception 'SETTLEMENT_NOT_FOUND_OR_FORBIDDEN'; end if;
  if v_s.status<>'pending_approval' then raise exception 'SETTLEMENT_NOT_PENDING'; end if;
  if not exists(select 1 from public.p2p_profiles where user_id=v_s.from_user_id and active) then raise exception 'SENDER_INACTIVE'; end if;
  perform 1 from public.p2p_wallets where user_id in (v_s.from_user_id,v_s.to_user_id) order by user_id for update;
  if (select diamond_locked from public.p2p_wallets where user_id=v_s.from_user_id)<v_s.diamond_amount then raise exception 'SETTLEMENT_ESCROW_MISMATCH'; end if;
  if v_s.settlement_type='coins' and (select coin_available from public.p2p_wallets where user_id=v_s.to_user_id)<v_s.coin_amount then raise exception 'RECEIVER_INSUFFICIENT_COINS'; end if;
  update public.p2p_wallets set diamond_locked=diamond_locked-v_s.diamond_amount,updated_at=now() where user_id=v_s.from_user_id;
  update public.p2p_wallets set diamond_available=diamond_available+v_s.diamond_amount,updated_at=now() where user_id=v_s.to_user_id;
  if v_s.settlement_type='coins' then
    update public.p2p_wallets set coin_available=coin_available-v_s.coin_amount,updated_at=now() where user_id=v_s.to_user_id and coin_available>=v_s.coin_amount;
    if not found then raise exception 'RECEIVER_INSUFFICIENT_COINS'; end if;
    update public.p2p_wallets set coin_available=coin_available+v_s.coin_amount,updated_at=now() where user_id=v_s.from_user_id;
    insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,to_user_id,actor_id,metadata,settlement_id)
    values(gen_random_uuid(),'coin_transfer','coin',v_s.coin_amount,v_s.to_user_id,v_s.from_user_id,v_actor,
      jsonb_build_object('stage','settlement_approved','settlement_id',v_s.id),v_s.id);
  end if;
  update public.p2p_agent_settlements set status='approved',approved_by=v_actor,approved_at=now(),updated_at=now() where id=v_s.id;
  insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,to_user_id,actor_id,metadata,settlement_id)
  values(gen_random_uuid(),'agent_settlement','diamond',v_s.diamond_amount,v_s.from_user_id,v_s.to_user_id,v_actor,
    jsonb_build_object('stage','approved','settlement_type',v_s.settlement_type,'fiat_currency',v_s.fiat_currency,'coin_amount',v_s.coin_amount),v_s.id);
  insert into public.p2p_notifications(recipient_id,event_type,payload)
  values(v_s.from_user_id,'agent_settlement_approved',jsonb_build_object('settlement_id',v_s.id,'diamond_amount',v_s.diamond_amount));
end $$;
revoke all on function public.p2p_approve_agent_settlement(uuid) from public,anon;
grant execute on function public.p2p_approve_agent_settlement(uuid) to authenticated;

create or replace function public.p2p_reject_agent_settlement(p_settlement_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_s public.p2p_agent_settlements%rowtype;
begin
  if v_actor is null or length(trim(coalesce(p_reason,'')))<3 then raise exception 'REJECTION_REASON_REQUIRED'; end if;
  select * into v_s from public.p2p_agent_settlements where id=p_settlement_id for update;
  if not found or v_s.to_user_id<>v_actor then raise exception 'SETTLEMENT_NOT_FOUND_OR_FORBIDDEN'; end if;
  if v_s.status<>'pending_approval' then raise exception 'SETTLEMENT_NOT_PENDING'; end if;
  update public.p2p_wallets set diamond_locked=diamond_locked-v_s.diamond_amount,diamond_available=diamond_available+v_s.diamond_amount,updated_at=now()
    where user_id=v_s.from_user_id and diamond_locked>=v_s.diamond_amount;
  if not found then raise exception 'SETTLEMENT_ESCROW_MISMATCH'; end if;
  update public.p2p_agent_settlements set status='rejected',rejection_reason=left(trim(p_reason),1000),updated_at=now() where id=v_s.id;
  insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,to_user_id,actor_id,metadata,settlement_id)
  values(gen_random_uuid(),'agent_settlement','diamond',v_s.diamond_amount,v_s.to_user_id,v_s.from_user_id,v_actor,
    jsonb_build_object('stage','rejected_refund','reason',left(trim(p_reason),1000)),v_s.id);
  insert into public.p2p_notifications(recipient_id,event_type,payload)
  values(v_s.from_user_id,'agent_settlement_rejected',jsonb_build_object('settlement_id',v_s.id,'reason',left(trim(p_reason),1000)));
end $$;
revoke all on function public.p2p_reject_agent_settlement(uuid,text) from public,anon;
grant execute on function public.p2p_reject_agent_settlement(uuid,text) to authenticated;

commit;
