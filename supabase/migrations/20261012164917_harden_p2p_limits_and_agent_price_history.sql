-- Serialize P2P wallet locking and enforce per-agent price change audit history.
create or replace function public.coin_p2p_transfer(p_recipient_code text,p_coins bigint,p_request_key text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid:=auth.uid(); v_recipient public.profiles%rowtype; v_tx uuid; v_status text; v_meta jsonb; v_input jsonb;
  v_sender_balance bigint; v_recipient_balance bigint; v_settings public.coin_economy_settings%rowtype; v_result jsonb;
  v_code text:=trim(coalesce(p_recipient_code,'')); v_daily bigint;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_coins is null or p_coins<=0 then raise exception 'INVALID_COIN_AMOUNT'; end if;
  if coalesce(p_request_key,'') !~ '^[A-Za-z0-9:_-]{8,160}$' then raise exception 'VALID_IDEMPOTENCY_KEY_REQUIRED'; end if;
  select * into v_settings from public.coin_economy_settings where id=true;
  if not found or not v_settings.p2p_user_transfers_enabled then raise exception 'USER_TO_USER_TRANSFERS_DISABLED'; end if;
  if p_coins>v_settings.max_p2p_transfer then raise exception 'TRANSFER_LIMIT_EXCEEDED'; end if;
  if v_code='' then raise exception 'RECIPIENT_JALWA_ID_REQUIRED'; end if;
  v_input:=jsonb_build_object('recipient_code',lower(v_code),'coins',p_coins);
  insert into public.coin_economy_transactions(actor_id,request_key,kind,status,reference_type,metadata)
    values(v_actor,p_request_key,'user_p2p_transfer','pending','coin_p2p_transfer',jsonb_build_object('input',v_input))
    on conflict(actor_id,request_key) where request_key is not null do nothing;
  select id,status,metadata into v_tx,v_status,v_meta from public.coin_economy_transactions where actor_id=v_actor and request_key=p_request_key for update;
  if v_meta->'input' is distinct from v_input then raise exception 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'; end if;
  if v_status='posted' then return v_meta->'result'; end if;
  select * into v_recipient from public.profiles where user_code=v_code or lower(username)=lower(v_code)
    order by case when user_code=v_code then 0 else 1 end limit 1;
  if not found or v_recipient.status<>'active' then raise exception 'RECIPIENT_NOT_FOUND_OR_INACTIVE'; end if;
  if v_recipient.id=v_actor then raise exception 'SELF_TRANSFER_NOT_ALLOWED'; end if;
  perform p.id from public.profiles p where p.id in (v_actor,v_recipient.id) order by p.id for update;
  select * into v_recipient from public.profiles where id=v_recipient.id;
  if not found or v_recipient.status<>'active' then raise exception 'RECIPIENT_NOT_FOUND_OR_INACTIVE'; end if;
  if coalesce(v_recipient.coins,0)>9000000000000000000-p_coins then raise exception 'RECIPIENT_BALANCE_LIMIT_EXCEEDED'; end if;
  select coalesce(sum(-e.amount),0) into v_daily from public.coin_economy_entries e join public.coin_economy_transactions t on t.id=e.transaction_id
    where t.actor_id=v_actor and t.kind='user_p2p_transfer' and t.status='posted' and t.created_at>=date_trunc('day',now())
      and e.account_type='user_wallet' and e.account_id=v_actor and e.amount<0;
  if v_daily+p_coins>v_settings.daily_p2p_limit then raise exception 'DAILY_TRANSFER_LIMIT_EXCEEDED'; end if;
  perform set_config('app.coin_operation','user_p2p_transfer',true);
  perform set_config('app.trusted_definer','on',true);
  update public.profiles set coins=coins-p_coins,updated_at=now() where id=v_actor and status='active' and coins>=p_coins returning coins into v_sender_balance;
  if not found then raise exception 'SENDER_INACTIVE_OR_INSUFFICIENT_BALANCE'; end if;
  update public.profiles set coins=coins+p_coins,updated_at=now() where id=v_recipient.id returning coins into v_recipient_balance;
  perform set_config('app.trusted_definer','off',true);
  insert into public.coin_economy_entries(transaction_id,account_type,account_id,amount,balance_after)
    values(v_tx,'user_wallet',v_actor,-p_coins,v_sender_balance),(v_tx,'user_wallet',v_recipient.id,p_coins,v_recipient_balance);
  insert into public.wallet_transactions(user_id,kind,coins,coins_delta,balance_coins_after,ref_type,ref_id,note)
    values(v_actor,'p2p_sent',p_coins,-p_coins,v_sender_balance,'coin_p2p_transfer',v_tx,'P2P coins sent'),
          (v_recipient.id,'p2p_received',p_coins,p_coins,v_recipient_balance,'coin_p2p_transfer',v_tx,'P2P coins received');
  v_result:=jsonb_build_object('transaction_id',v_tx,'coins_transferred',p_coins,'sender_balance_after',v_sender_balance,
    'recipient_balance_after',v_recipient_balance,'recipient_id',v_recipient.id,'recipient_code',v_recipient.user_code);
  update public.coin_economy_transactions set status='posted',metadata=jsonb_build_object('input',v_input,'result',v_result),completed_at=now() where id=v_tx;
  return v_result;
end; $$;
revoke all on function public.coin_p2p_transfer(text,bigint,text) from public, anon;
grant execute on function public.coin_p2p_transfer(text,bigint,text) to authenticated;

create or replace function public.coin_agent_price_history_audit()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='INSERT' then
    if new.sell_rate is not null then insert into public.coin_agent_price_history(agent_id,price_kind,old_price,new_price,currency_code,changed_by)
      values(new.user_id,'coin_sell_rate',null,new.sell_rate,coalesce(new.currency_code,'PKR'),auth.uid()); end if;
    if new.buy_rate is not null then insert into public.coin_agent_price_history(agent_id,price_kind,old_price,new_price,currency_code,changed_by)
      values(new.user_id,'coin_buy_rate',null,new.buy_rate,coalesce(new.currency_code,'PKR'),auth.uid()); end if;
    if new.diamond_buy_rate_pkr_per_1000 is not null then insert into public.coin_agent_price_history(agent_id,price_kind,old_price,new_price,currency_code,changed_by)
      values(new.user_id,'diamond_buy_rate',null,new.diamond_buy_rate_pkr_per_1000,'PKR',auth.uid()); end if;
    return new;
  end if;
  if new.sell_rate is distinct from old.sell_rate then insert into public.coin_agent_price_history(agent_id,price_kind,old_price,new_price,currency_code,changed_by)
    values(new.user_id,'coin_sell_rate',old.sell_rate,new.sell_rate,coalesce(new.currency_code,'PKR'),auth.uid()); end if;
  if new.buy_rate is distinct from old.buy_rate then insert into public.coin_agent_price_history(agent_id,price_kind,old_price,new_price,currency_code,changed_by)
    values(new.user_id,'coin_buy_rate',old.buy_rate,new.buy_rate,coalesce(new.currency_code,'PKR'),auth.uid()); end if;
  if new.diamond_buy_rate_pkr_per_1000 is distinct from old.diamond_buy_rate_pkr_per_1000 then insert into public.coin_agent_price_history(agent_id,price_kind,old_price,new_price,currency_code,changed_by)
    values(new.user_id,'diamond_buy_rate',old.diamond_buy_rate_pkr_per_1000,new.diamond_buy_rate_pkr_per_1000,'PKR',auth.uid()); end if;
  return new;
end; $$;
drop trigger if exists coin_agent_price_history_audit_trg on public.agent_profiles;
create trigger coin_agent_price_history_audit_trg after insert or update of sell_rate,buy_rate,diamond_buy_rate_pkr_per_1000
on public.agent_profiles for each row execute function public.coin_agent_price_history_audit();
revoke all on function public.coin_agent_price_history_audit() from public, anon, authenticated;
