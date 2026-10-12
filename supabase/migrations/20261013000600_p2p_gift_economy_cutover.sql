-- Cut gift accounting over to the isolated P2P economy. Keep gift_sends only as event/media history.
begin;
create table if not exists public.p2p_coin_cost_basis (
 user_id uuid primary key references public.p2p_profiles(user_id) on delete restrict,
 coins_remaining bigint not null default 0 check(coins_remaining>=0),
 cost_pkr_remaining numeric(30,8) not null default 0 check(cost_pkr_remaining>=0),
 updated_at timestamptz not null default now()
);
alter table public.p2p_coin_cost_basis enable row level security;
revoke all on public.p2p_coin_cost_basis from public,anon,authenticated;

create or replace function public.p2p_agent_complete_coin_order(p_order_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_order public.p2p_coin_orders%rowtype; v_rate numeric(20,8);
begin
 select * into v_order from public.p2p_coin_orders where id=p_order_id for update;
 if v_user is null or not found or v_order.agent_id<>v_user or v_order.status<>'payment_submitted' then raise exception 'ORDER_NOT_COMPLETABLE'; end if;
 select pkr_per_fiat_unit into v_rate from public.p2p_coin_fiat_rates where currency_code=v_order.fiat_currency and active;
 if v_rate is null then raise exception 'COIN_FIAT_RATE_UNAVAILABLE'; end if;
 perform 1 from public.p2p_wallets where user_id in (v_order.agent_id,v_order.buyer_id) order by user_id for update;
 if (select count(*) from public.p2p_wallets where user_id in (v_order.agent_id,v_order.buyer_id))<>2 then raise exception 'P2P_WALLET_REQUIRED'; end if;
 update public.p2p_wallets set coin_locked=coin_locked-v_order.amount_coins,updated_at=now() where user_id=v_order.agent_id and coin_locked>=v_order.amount_coins;
 if not found then raise exception 'ESCROW_BALANCE_INVALID'; end if;
 update public.p2p_wallets set coin_available=coin_available+v_order.amount_coins,updated_at=now() where user_id=v_order.buyer_id;
 insert into public.p2p_coin_cost_basis(user_id,coins_remaining,cost_pkr_remaining)
 values(v_order.buyer_id,v_order.amount_coins,round(v_order.fiat_amount*v_rate,8))
 on conflict(user_id) do update set coins_remaining=public.p2p_coin_cost_basis.coins_remaining+excluded.coins_remaining,
 cost_pkr_remaining=public.p2p_coin_cost_basis.cost_pkr_remaining+excluded.cost_pkr_remaining,updated_at=now();
 update public.p2p_coin_orders set status='completed',completed_at=now(),updated_at=now() where id=p_order_id;
 insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,to_user_id,actor_id,metadata)
 values(gen_random_uuid(),'coin_transfer','coin',v_order.amount_coins,v_order.agent_id,v_order.buyer_id,v_user,
 jsonb_build_object('phase','order_escrow_release','order_id',p_order_id,'paid_fiat',v_order.fiat_amount,'currency',v_order.fiat_currency));
end $$;
revoke all on function public.p2p_agent_complete_coin_order(uuid) from public,anon;
grant execute on function public.p2p_agent_complete_coin_order(uuid) to authenticated;

create or replace function public.send_gift(_room_id uuid,_receiver_id uuid,_gift_id uuid,_quantity integer,_write_message boolean default true)
returns public.gift_sends language plpgsql security definer set search_path=''
as $$
declare
 v_sender uuid:=auth.uid(); g public.gifts%rowtype; v_row public.gift_sends;
 v_coins bigint; v_diamonds bigint; v_basis_coins bigint; v_cost_pkr numeric(30,8); v_diamond_price_pkr numeric;
 v_loop boolean; v_volume numeric; v_audio boolean; v_render jsonb;
begin
 if v_sender is null then raise exception 'Not authenticated'; end if;
 if _quantity is null or _quantity<1 or _quantity>100 then raise exception 'Invalid quantity'; end if;
 if _room_id is null or _receiver_id is null or _gift_id is null or _receiver_id=v_sender then raise exception 'Invalid gift parameters'; end if;
 insert into public.p2p_profiles(user_id,role) values(v_sender,'user') on conflict(user_id) do nothing;
 insert into public.p2p_profiles(user_id,role) values(_receiver_id,'user') on conflict(user_id) do nothing;
 select * into g from public.gifts where id=_gift_id and coalesce(is_active,active,true)=true limit 1;
 if not found then raise exception 'Gift not found or inactive'; end if;
 if not exists(select 1 from public.live_rooms where id=_room_id and status<>'ended') then raise exception 'Room not found or ended'; end if;
 if not exists(select 1 from public.profiles where id=_receiver_id) then raise exception 'Receiver profile not found'; end if;
 select loop,audio_volume,audio_enabled,render_config into v_loop,v_volume,v_audio,v_render from public.gifts where id=_gift_id;
 v_coins:=coalesce(g.price_coins,g.price,0)::bigint*_quantity;
 if v_coins<=0 then raise exception 'Gift has no valid coin price'; end if;
 select diamond_price_pkr into v_diamond_price_pkr from public.app_settings where id='global' limit 1;
 if coalesce(v_diamond_price_pkr,0)<=0 then raise exception 'Diamond rate is not configured'; end if;
 perform 1 from public.p2p_wallets where user_id in (v_sender,_receiver_id) order by user_id for update;
 if (select count(*) from public.p2p_wallets where user_id in (v_sender,_receiver_id))<>2 then raise exception 'P2P_WALLET_REQUIRED'; end if;
 if (select coin_available from public.p2p_wallets where user_id=v_sender)<v_coins then raise exception 'Insufficient P2P coins'; end if;
 select coins_remaining,cost_pkr_remaining into v_basis_coins,v_cost_pkr from public.p2p_coin_cost_basis where user_id=v_sender for update;
 if not found or coalesce(v_basis_coins,0)<v_coins then raise exception 'Insufficient paid P2P coin balance for gifting'; end if;
 v_cost_pkr:=round(v_cost_pkr*v_coins/nullif(v_basis_coins,0),8);
 v_diamonds:=round((v_cost_pkr*0.25)/v_diamond_price_pkr)::bigint;
 update public.p2p_wallets set coin_available=coin_available-v_coins,updated_at=now() where user_id=v_sender and coin_available>=v_coins;
 if not found then raise exception 'Insufficient P2P coins'; end if;
 update public.p2p_coin_cost_basis set coins_remaining=coins_remaining-v_coins,cost_pkr_remaining=greatest(0,round(cost_pkr_remaining-v_cost_pkr,8)),updated_at=now() where user_id=v_sender;
 update public.p2p_wallets set diamond_available=diamond_available+v_diamonds,updated_at=now() where user_id=_receiver_id;
 insert into public.gift_sends(room_id,sender_id,receiver_id,gift_id,quantity,coins_spent,diamonds_earned,created_at,finalized_at,
 gift_name,gift_emoji,gift_icon,gift_animation,gift_clip_path,gift_clip_type,gift_image_url,gift_sound_url,gift_audio_url,gift_priority,gift_duration_ms,gift_loop,gift_audio_volume,gift_audio_enabled,gift_render_config)
 values(_room_id,v_sender,_receiver_id,_gift_id,_quantity,v_coins,v_diamonds,now(),now(),g.name,g.emoji,g.icon,g.animation,g.clip_path,g.clip_type,g.image_url,g.sound_url,g.audio_url,g.priority,g.duration_ms,v_loop,v_volume,v_audio,v_render)
 returning * into v_row;
 insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,to_user_id,actor_id,metadata)
 values(gen_random_uuid(),'gift_spend','coin',v_coins,v_sender,_receiver_id,v_sender,jsonb_build_object('gift_send_id',v_row.id,'gift_id',_gift_id,'quantity',_quantity,'cost_pkr',v_cost_pkr));
 if v_diamonds>0 then
  insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,to_user_id,actor_id,metadata)
  values(gen_random_uuid(),'diamond_earned','diamond',v_diamonds,v_sender,_receiver_id,v_sender,jsonb_build_object('gift_send_id',v_row.id,'gift_id',_gift_id,'source','gift_payout'));
 end if;
 return v_row;
end $$;
revoke all on function public.send_gift(uuid,uuid,uuid,integer,boolean) from public,anon;
grant execute on function public.send_gift(uuid,uuid,uuid,integer,boolean) to authenticated;
commit;
