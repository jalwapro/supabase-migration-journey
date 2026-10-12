-- VIP purchase uses P2P coin balances; legacy profile coin fields and wallet_transactions are not used.
begin;
create or replace function public.purchase_vip(_tier_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_user uuid:=auth.uid(); v_tier record; v_profile record; v_wallet public.p2p_wallets%rowtype;
 v_expiry timestamptz; v_balance bigint; v_basis public.p2p_coin_cost_basis%rowtype; v_paid bigint; v_cost numeric(30,8);
begin
 if v_user is null then raise exception 'Not authenticated' using errcode='42501'; end if;
 select * into v_tier from public.vip_tiers where id=_tier_id and is_active;
 if not found then raise exception 'VIP tier not found or inactive'; end if;
 insert into public.p2p_profiles(user_id,role) values(v_user,'user') on conflict(user_id) do nothing;
 select * into v_profile from public.profiles where id=v_user for update;
 if not found then raise exception 'Profile not found'; end if;
 select * into v_wallet from public.p2p_wallets where user_id=v_user for update;
 if not found then raise exception 'P2P wallet not found'; end if;
 if coalesce(v_wallet.coin_available,0)<v_tier.price then raise exception 'Insufficient P2P coins'; end if;
 v_expiry:=case when v_profile.is_vip and v_profile.vip_expiry is not null and v_profile.vip_expiry>now()
   then v_profile.vip_expiry+make_interval(days=>v_tier.duration_days)
   else now()+make_interval(days=>v_tier.duration_days) end;
 update public.p2p_wallets set coin_available=coin_available-v_tier.price,updated_at=now() where user_id=v_user returning coin_available into v_balance;
 select * into v_basis from public.p2p_coin_cost_basis where user_id=v_user for update;
 if found and coalesce(v_basis.coins_remaining,0)>0 then
   v_paid:=least(v_basis.coins_remaining,v_tier.price);
   v_cost:=round(v_basis.cost_pkr_remaining*v_paid/nullif(v_basis.coins_remaining,0),8);
   update public.p2p_coin_cost_basis set coins_remaining=coins_remaining-v_paid,cost_pkr_remaining=greatest(0,round(cost_pkr_remaining-v_cost,8)),updated_at=now() where user_id=v_user;
 end if;
 insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,actor_id,metadata)
 values(gen_random_uuid(),'gift_spend','coin',v_tier.price,v_user,v_user,jsonb_build_object('purpose','vip_purchase','tier_id',_tier_id,'tier_name',v_tier.name));
 perform set_config('app.trusted_definer','on',true);
 update public.profiles set is_vip=true,vip_expiry=v_expiry,vip_tier=v_tier.name,vip_updated_at=now(),updated_at=now() where id=v_user;
 perform set_config('app.trusted_definer','off',true);
 return jsonb_build_object('ok',true,'tier',v_tier.name,'coins_after',v_balance,'vip_expiry',v_expiry);
end $$;
revoke all on function public.purchase_vip(uuid) from public,anon;
grant execute on function public.purchase_vip(uuid) to authenticated;
commit;
