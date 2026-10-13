-- Lucky Spin uses P2P balances and does not touch legacy profile coins or wallet_transactions.
begin;
create or replace function public.play_lucky_spin(_bet int)
returns public.game_rounds language plpgsql security definer set search_path=''
as $$
declare
 v_user uuid:=auth.uid(); v_game public.games%rowtype; v_wallet public.p2p_wallets%rowtype;
 v_basis public.p2p_coin_cost_basis%rowtype; v_paid bigint; v_cost numeric(30,8);
 v_roll int; v_mult numeric(6,2); v_outcome text; v_payout bigint; v_round public.game_rounds;
begin
 if v_user is null then raise exception 'not authenticated'; end if;
 select * into v_game from public.games where slug='lucky_spin' and active;
 if not found then raise exception 'game not available'; end if;
 if _bet<v_game.min_bet or _bet>v_game.max_bet then raise exception 'bet out of range (% - %)',v_game.min_bet,v_game.max_bet; end if;
 insert into public.p2p_profiles(user_id,role) values(v_user,'user') on conflict(user_id) do nothing;
 select * into v_wallet from public.p2p_wallets where user_id=v_user for update;
 if not found or v_wallet.coin_available<_bet then raise exception 'insufficient P2P coins'; end if;
 update public.p2p_wallets set coin_available=coin_available-_bet,updated_at=now() where user_id=v_user;
 select * into v_basis from public.p2p_coin_cost_basis where user_id=v_user for update;
 if found and coalesce(v_basis.coins_remaining,0)>0 then
  v_paid:=least(v_basis.coins_remaining,_bet);
  v_cost:=round(v_basis.cost_pkr_remaining*v_paid/nullif(v_basis.coins_remaining,0),8);
  update public.p2p_coin_cost_basis set coins_remaining=coins_remaining-v_paid,cost_pkr_remaining=greatest(0,round(cost_pkr_remaining-v_cost,8)),updated_at=now() where user_id=v_user;
 end if;
 v_roll:=floor(random()*100)+1;
 if v_roll<=55 then v_outcome:='lose';v_mult:=0;
 elsif v_roll<=80 then v_outcome:='1.5x';v_mult:=1.5;
 elsif v_roll<=93 then v_outcome:='2x';v_mult:=2;
 elsif v_roll<=99 then v_outcome:='5x';v_mult:=5;
 else v_outcome:='10x';v_mult:=10; end if;
 v_payout:=floor(_bet*v_mult);
 if v_payout>0 then update public.p2p_wallets set coin_available=coin_available+v_payout,updated_at=now() where user_id=v_user; end if;
 insert into public.game_rounds(game_id,user_id,bet_coins,outcome,multiplier,payout_coins)
 values(v_game.id,v_user,_bet,v_outcome,v_mult,v_payout) returning * into v_round;
 insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,actor_id,metadata)
 values(gen_random_uuid(),'gift_spend','coin',_bet,v_user,v_user,jsonb_build_object('purpose','lucky_spin_bet','round_id',v_round.id,'outcome',v_outcome));
 if v_payout>0 then
  insert into public.p2p_ledger(request_key,kind,asset,amount,to_user_id,actor_id,metadata)
  values(gen_random_uuid(),'coin_issue','coin',v_payout,v_user,v_user,jsonb_build_object('purpose','lucky_spin_payout','round_id',v_round.id,'outcome',v_outcome));
 end if;
 return v_round;
end $$;
revoke all on function public.play_lucky_spin(int) from public,anon;
grant execute on function public.play_lucky_spin(int) to authenticated;
commit;
