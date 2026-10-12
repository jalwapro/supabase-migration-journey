-- Require payment reference and idempotency key for seller-to-user transfers.
create or replace function public.coin_seller_transfer(p_buyer_code text, p_coins bigint, p_request_key text, p_payment_reference text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := auth.uid(); v_seller public.coin_sellers%rowtype; v_inventory public.coin_seller_inventory%rowtype;
  v_buyer public.profiles%rowtype; v_balance_seller bigint; v_balance_buyer bigint; v_tx uuid; v_status text; v_meta jsonb;
  v_request_key text:=trim(coalesce(p_request_key,'')); v_payment_ref text:=left(trim(coalesce(p_payment_reference,'')),160);
  v_lookup text:=trim(coalesce(p_buyer_code,'')); v_input jsonb; v_result jsonb;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_coins is null or p_coins<=0 or p_coins>1000000 then raise exception 'INVALID_COIN_AMOUNT'; end if;
  if v_request_key !~ '^[A-Za-z0-9:_-]{8,160}$' then raise exception 'VALID_IDEMPOTENCY_KEY_REQUIRED'; end if;
  if length(v_payment_ref)<3 then raise exception 'PAYMENT_REFERENCE_REQUIRED'; end if;
  if v_lookup='' then raise exception 'BUYER_JALWA_ID_REQUIRED'; end if;
  v_input:=jsonb_build_object('buyer_code',lower(v_lookup),'coins',p_coins,'payment_reference',v_payment_ref);
  insert into public.coin_economy_transactions(actor_id,request_key,kind,status,reference_type,metadata)
    values(v_actor,v_request_key,'seller_transfer','pending','coin_seller_transfer',jsonb_build_object('input',v_input))
    on conflict(actor_id,request_key) where request_key is not null do nothing;
  select id,status,metadata into v_tx,v_status,v_meta from public.coin_economy_transactions
    where actor_id=v_actor and request_key=v_request_key for update;
  if v_meta->'input' is distinct from v_input then raise exception 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'; end if;
  if v_status='posted' then return v_meta->'result'; end if;
  select * into v_seller from public.coin_sellers where user_id=v_actor and is_active for update;
  if not found then raise exception 'SELLER_NOT_ACTIVE'; end if;
  insert into public.coin_seller_inventory(seller_id) values(v_actor) on conflict(seller_id) do nothing;
  select * into v_inventory from public.coin_seller_inventory where seller_id=v_actor for update;
  if v_inventory.available_coins<p_coins then raise exception 'INSUFFICIENT_SELLER_INVENTORY'; end if;
  select * into v_buyer from public.profiles where user_code=v_lookup or lower(username)=lower(v_lookup)
    order by case when user_code=v_lookup then 0 else 1 end limit 1 for update;
  if not found or v_buyer.status<>'active' then raise exception 'BUYER_NOT_FOUND_OR_INACTIVE'; end if;
  if v_buyer.id=v_actor then raise exception 'SELF_TRANSFER_NOT_ALLOWED'; end if;
  if coalesce(v_buyer.coins,0)<0 or coalesce(v_buyer.coins,0)>9000000000000000000-p_coins then raise exception 'BUYER_BALANCE_LIMIT_EXCEEDED'; end if;
  perform set_config('app.coin_operation','seller_transfer',true);
  perform set_config('app.trusted_definer','on',true);
  update public.profiles set coins=coalesce(coins,0)+p_coins,updated_at=now() where id=v_buyer.id returning coins into v_balance_buyer;
  update public.coin_seller_inventory set available_coins=available_coins-p_coins,total_sold=total_sold+p_coins,updated_at=now()
    where seller_id=v_actor returning available_coins into v_balance_seller;
  perform set_config('app.trusted_definer','off',true);
  insert into public.coin_seller_transactions(seller_id,buyer_id,kind,coins,inventory_delta,seller_balance_after,buyer_balance_after,payment_reference,note,created_by)
    values(v_actor,v_buyer.id,'sale',p_coins,-p_coins,v_balance_seller,v_balance_buyer,v_payment_ref,'Payment reference recorded by Coin Seller',v_actor);
  insert into public.wallet_transactions(user_id,kind,coins,coins_delta,balance_coins_after,ref_type,ref_id,note)
    values(v_buyer.id,'seller_transfer',p_coins,p_coins,v_balance_buyer,'coin_seller_transfer',v_tx,'Coins received from JALWA Coin Seller');
  insert into public.coin_economy_entries(transaction_id,account_type,account_id,amount,balance_after)
    values(v_tx,'seller_inventory',v_actor,-p_coins,v_balance_seller),(v_tx,'user_wallet',v_buyer.id,p_coins,v_balance_buyer);
  v_result:=jsonb_build_object('transaction_id',v_tx,'buyer_id',v_buyer.id,'buyer_username',v_buyer.username,
    'buyer_code',v_buyer.user_code,'coins_transferred',p_coins,'buyer_balance_after',v_balance_buyer,'seller_balance_after',v_balance_seller);
  update public.coin_economy_transactions set status='posted',metadata=jsonb_build_object('input',v_input,'result',v_result),
    completed_at=now(),reference_id=v_tx where id=v_tx;
  return v_result;
end; $$;
revoke all on function public.coin_seller_transfer(text,bigint,text) from public, anon, authenticated;
revoke all on function public.coin_seller_transfer(text,bigint,text,text) from public, anon;
grant execute on function public.coin_seller_transfer(text,bigint,text,text) to authenticated;
