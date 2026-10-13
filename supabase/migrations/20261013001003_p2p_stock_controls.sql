-- Separate audited Admin stock issuance from agent/user transfers.
begin;

create or replace function public.p2p_admin_mint_stock(p_request_key uuid,p_amount bigint)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_id uuid; v_old public.p2p_ledger%rowtype;
begin
  if v_actor is null or p_request_key is null or p_amount is null or p_amount<=0 then raise exception 'INVALID_STOCK_ISSUANCE'; end if;
  if (select p2p_private.current_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_old from public.p2p_ledger where request_key=p_request_key;
  if found then
    if v_old.actor_id=v_actor and v_old.to_user_id=v_actor and v_old.asset='coin' and v_old.kind='coin_issue' and v_old.amount=p_amount then return v_old.id; end if;
    raise exception 'IDEMPOTENCY_KEY_REUSED';
  end if;
  perform 1 from public.p2p_wallets where user_id=v_actor for update;
  if not found then raise exception 'ADMIN_WALLET_NOT_FOUND'; end if;
  update public.p2p_wallets set coin_available=coin_available+p_amount,updated_at=now() where user_id=v_actor;
  insert into public.p2p_ledger(request_key,kind,asset,amount,to_user_id,actor_id,metadata)
  values(p_request_key,'coin_issue','coin',p_amount,v_actor,v_actor,jsonb_build_object('reason','admin_stock_issuance','audited',true))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.p2p_admin_mint_stock(uuid,bigint) from public,anon;
grant execute on function public.p2p_admin_mint_stock(uuid,bigint) to authenticated;

create or replace function public.p2p_admin_grant_coins(p_request_key uuid,p_to_user_id uuid,p_amount bigint)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_id uuid; v_existing public.p2p_ledger%rowtype; v_role public.p2p_role;
begin
  if v_actor is null or p_request_key is null or p_to_user_id is null or p_amount is null or p_amount<=0 then raise exception 'INVALID_GRANT'; end if;
  if (select p2p_private.current_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  select role into v_role from public.p2p_profiles where user_id=p_to_user_id and active;
  if v_role in ('super_agent','sub_agent') then raise exception 'AGENT_STOCK_MUST_USE_AUDITED_TRANSFER'; end if;
  if v_role is null then raise exception 'RECIPIENT_P2P_PROFILE_REQUIRED'; end if;
  select * into v_existing from public.p2p_ledger where request_key=p_request_key;
  if found then
    if v_existing.actor_id=v_actor and v_existing.to_user_id=p_to_user_id and v_existing.asset='coin' and v_existing.kind='coin_issue' and v_existing.amount=p_amount then return v_existing.id; end if;
    raise exception 'IDEMPOTENCY_KEY_REUSED';
  end if;
  perform 1 from public.p2p_wallets where user_id=p_to_user_id for update;
  if not found then raise exception 'RECIPIENT_P2P_PROFILE_REQUIRED'; end if;
  update public.p2p_wallets set coin_available=coin_available+p_amount,updated_at=now() where user_id=p_to_user_id;
  insert into public.p2p_ledger(request_key,kind,asset,amount,to_user_id,actor_id,metadata)
  values(p_request_key,'coin_issue','coin',p_amount,p_to_user_id,v_actor,jsonb_build_object('reason','admin_user_grant','audited',true))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.p2p_admin_grant_coins(uuid,uuid,bigint) from public,anon;
grant execute on function public.p2p_admin_grant_coins(uuid,uuid,bigint) to authenticated;

commit;
