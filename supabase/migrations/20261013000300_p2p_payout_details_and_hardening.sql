-- P2P payout destination details and hierarchy/transfer hardening.
-- Additive to the independent P2P economy; no legacy wallet or LiveKit objects touched.
begin;

alter table public.p2p_diamond_withdrawals
  add column if not exists payout_method text,
  add column if not exists payout_account_name text,
  add column if not exists payout_account_number text;

alter table public.p2p_diamond_withdrawals
  add constraint p2p_withdrawal_payout_method_check
    check (payout_method is null or payout_method in ('JazzCash','Easypaisa','Bank Transfer','Raast','Other')),
  add constraint p2p_withdrawal_payout_account_name_check
    check (payout_account_name is null or length(trim(payout_account_name)) between 2 and 120),
  add constraint p2p_withdrawal_payout_account_number_check
    check (payout_account_number is null or length(trim(payout_account_number)) between 5 and 80);

-- The old overload would allow new requests without a payout destination.
revoke all on function public.p2p_request_diamond_withdrawal(uuid,uuid,bigint,text) from public,anon,authenticated;

create or replace function public.p2p_request_diamond_withdrawal(
  p_request_key uuid,
  p_sub_agent_id uuid,
  p_amount bigint,
  p_fiat_currency text,
  p_payout_method text,
  p_payout_account_name text,
  p_payout_account_number text
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_super uuid;
  v_id uuid;
  v_rate numeric(20,8);
  v_fiat numeric(20,2);
  v_old public.p2p_diamond_withdrawals%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_request_key is null or p_amount is null or p_amount<=0
     or p_fiat_currency !~ '^[A-Z]{3}$' then raise exception 'INVALID_REQUEST'; end if;
  if p_payout_method not in ('JazzCash','Easypaisa','Bank Transfer','Raast','Other')
     or length(trim(coalesce(p_payout_account_name,''))) not between 2 and 120
     or length(trim(coalesce(p_payout_account_number,''))) not between 5 and 80 then
    raise exception 'VALID_PAYOUT_DETAILS_REQUIRED';
  end if;

  select * into v_old from public.p2p_diamond_withdrawals
    where user_id=v_user and request_key=p_request_key;
  if found then
    if v_old.sub_agent_id=p_sub_agent_id and v_old.amount=p_amount
       and v_old.fiat_currency=p_fiat_currency
       and v_old.payout_method=p_payout_method
       and v_old.payout_account_name=trim(p_payout_account_name)
       and v_old.payout_account_number=trim(p_payout_account_number) then
      return v_old.id;
    end if;
    raise exception 'IDEMPOTENCY_KEY_REUSED';
  end if;

  if not exists(select 1 from public.p2p_profiles where user_id=v_user and role='user' and active)
    then raise exception 'ACTIVE_USER_REQUIRED'; end if;
  select super_agent_id into v_super from public.p2p_profiles
    where user_id=p_sub_agent_id and role='sub_agent' and active;
  if v_super is null or not p2p_private.valid_agent_pair(p_sub_agent_id,v_super)
    then raise exception 'INVALID_SUB_AGENT'; end if;
  select diamonds_per_fiat_unit into v_rate from public.p2p_exchange_rates
    where currency_code=p_fiat_currency and active;
  if v_rate is null then raise exception 'EXCHANGE_RATE_UNAVAILABLE'; end if;
  v_fiat:=round(p_amount::numeric/v_rate,2);
  if v_fiat<=0 then raise exception 'WITHDRAWAL_BELOW_MINIMUM_FIAT'; end if;

  perform 1 from public.p2p_wallets where user_id=v_user for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  if (select diamond_available from public.p2p_wallets where user_id=v_user)<p_amount
    then raise exception 'INSUFFICIENT_DIAMONDS'; end if;

  insert into public.p2p_diamond_withdrawals(
    request_key,user_id,sub_agent_id,super_agent_id,amount,fiat_currency,fiat_amount,diamond_rate,
    payout_method,payout_account_name,payout_account_number
  ) values (
    p_request_key,v_user,p_sub_agent_id,v_super,p_amount,p_fiat_currency,v_fiat,v_rate,
    p_payout_method,trim(p_payout_account_name),trim(p_payout_account_number)
  ) returning id into v_id;

  update public.p2p_wallets set diamond_available=diamond_available-p_amount,
    diamond_locked=diamond_locked+p_amount,updated_at=now() where user_id=v_user;
  insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,to_user_id,withdrawal_id,actor_id,metadata)
  values(gen_random_uuid(),'diamond_lock','diamond',p_amount,v_user,p_sub_agent_id,v_id,v_user,
    jsonb_build_object('currency',p_fiat_currency,'payout_method',p_payout_method));
  insert into public.p2p_notifications(recipient_id,withdrawal_id,event_type,payload)
  values(v_super,v_id,'diamond_withdrawal_created',jsonb_build_object('amount',p_amount,'currency',p_fiat_currency));
  return v_id;
end $$;
revoke all on function public.p2p_request_diamond_withdrawal(uuid,uuid,bigint,text,text,text,text) from public,anon;
grant execute on function public.p2p_request_diamond_withdrawal(uuid,uuid,bigint,text,text,text,text) to authenticated;

-- A transfer idempotency key is only reusable for the exact same operation.
-- Also fail closed if either party has no P2P wallet.
create or replace function public.p2p_transfer_coins(p_request_key uuid,p_to_user_id uuid,p_amount bigint)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_from_role public.p2p_role;
  v_to_role public.p2p_role;
  v_to_super uuid;
  v_id uuid;
  v_existing public.p2p_ledger%rowtype;
begin
  if v_actor is null or p_request_key is null or p_amount is null or p_amount<=0 or p_to_user_id is null
    then raise exception 'INVALID_TRANSFER'; end if;
  select * into v_existing from public.p2p_ledger where request_key=p_request_key;
  if found then
    if v_existing.actor_id=v_actor and v_existing.to_user_id=p_to_user_id
      and v_existing.from_user_id=v_actor and v_existing.asset='coin'
      and v_existing.kind='coin_transfer' and v_existing.amount=p_amount then return v_existing.id; end if;
    raise exception 'IDEMPOTENCY_KEY_REUSED';
  end if;

  select role into v_from_role from public.p2p_profiles where user_id=v_actor and active;
  select role,super_agent_id into v_to_role,v_to_super from public.p2p_profiles where user_id=p_to_user_id and active;
  if v_from_role is null or v_to_role is null or v_actor=p_to_user_id then raise exception 'INVALID_PARTIES'; end if;
  if not ((v_from_role='admin' and v_to_role='super_agent')
    or (v_from_role='super_agent' and v_to_role='sub_agent' and v_to_super=v_actor)
    or (v_from_role='sub_agent' and v_to_role='user'
      and exists(select 1 from public.p2p_profiles s where s.user_id=v_actor and s.role='sub_agent' and s.active)))
    then raise exception 'HIERARCHY_TRANSFER_FORBIDDEN'; end if;

  perform 1 from public.p2p_wallets where user_id in (v_actor,p_to_user_id) order by user_id for update;
  if (select count(*) from public.p2p_wallets where user_id in (v_actor,p_to_user_id))<>2
    then raise exception 'P2P_WALLET_REQUIRED'; end if;
  update public.p2p_wallets set coin_available=coin_available-p_amount,updated_at=now()
    where user_id=v_actor and coin_available>=p_amount;
  if not found then raise exception 'INSUFFICIENT_COINS'; end if;
  update public.p2p_wallets set coin_available=coin_available+p_amount,updated_at=now()
    where user_id=p_to_user_id;
  insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,to_user_id,actor_id)
    values(p_request_key,'coin_transfer','coin',p_amount,v_actor,p_to_user_id,v_actor) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.p2p_transfer_coins(uuid,uuid,bigint) from public,anon;
grant execute on function public.p2p_transfer_coins(uuid,uuid,bigint) to authenticated;

-- Do not orphan Sub-Agents under a demoted Super Agent.
create or replace function public.p2p_admin_assign_role(
  p_user_id uuid,p_role public.p2p_role,p_super_agent_id uuid default null,p_display_name text default null
) returns void language plpgsql security definer set search_path=''
as $$
declare v_old_role public.p2p_role;
begin
  if (select p2p_private.current_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_role='admin' then raise exception 'ADMIN_ROLE_MUST_BE_BOOTSTRAPPED_OUT_OF_BAND'; end if;
  select role into v_old_role from public.p2p_profiles where user_id=p_user_id for update;
  if v_old_role='super_agent' and p_role<>'super_agent'
    and exists(select 1 from public.p2p_profiles where super_agent_id=p_user_id and role='sub_agent' and active) then
    raise exception 'REASSIGN_OR_DEACTIVATE_SUBAGENTS_FIRST';
  end if;
  if p_role='sub_agent' then
    if p_super_agent_id is null or p_super_agent_id=p_user_id
      or not exists(select 1 from public.p2p_profiles where user_id=p_super_agent_id and role='super_agent' and active) then
      raise exception 'ACTIVE_SUPER_AGENT_REQUIRED';
    end if;
  elsif p_super_agent_id is not null then raise exception 'ONLY_SUB_AGENT_HAS_PARENT'; end if;
  insert into public.p2p_profiles(user_id,role,super_agent_id,display_name)
  values(p_user_id,p_role,p_super_agent_id,nullif(trim(p_display_name),''))
  on conflict(user_id) do update set role=excluded.role,super_agent_id=excluded.super_agent_id,
    display_name=excluded.display_name,updated_at=now();
end $$;
revoke all on function public.p2p_admin_assign_role(uuid,public.p2p_role,uuid,text) from public,anon;
grant execute on function public.p2p_admin_assign_role(uuid,public.p2p_role,uuid,text) to authenticated;

commit;
