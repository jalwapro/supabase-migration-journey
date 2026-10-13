-- Cashout RPC must enforce the listed agent's assigned local currency server-side.
begin;

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
  v_agent_currency text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_request_key is null or p_amount is null or p_amount<=0
     or p_fiat_currency !~ '^[A-Z]{3}$' then raise exception 'INVALID_REQUEST'; end if;
  if coalesce(p_payout_method,'') not in ('JazzCash','Easypaisa','Bank Transfer','Raast','Other')
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
  select p.super_agent_id,s.currency_code into v_super,v_agent_currency
    from public.p2p_profiles p join public.p2p_agent_settings s on s.agent_id=p.user_id and s.is_listed
    where p.user_id=p_sub_agent_id and p.role='sub_agent' and p.active;
  if v_super is null or not p2p_private.valid_agent_pair(p_sub_agent_id,v_super)
    then raise exception 'INVALID_OR_UNLISTED_SUB_AGENT'; end if;
  if p_fiat_currency<>v_agent_currency then raise exception 'AGENT_CURRENCY_MISMATCH'; end if;
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

commit;
