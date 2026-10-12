-- Cut gift spending and earnings over to the new P2P wallets.
-- Admin must configure the coin cost basis and PKR diamond conversion before
-- enabling gift sends; this avoids silently inventing payout economics.
begin;

alter table public.p2p_wallets
  add column if not exists coin_cost_pkr_remaining numeric(30,8) not null default 0
  check(coin_cost_pkr_remaining>=0);

create table public.p2p_gift_economy_settings (
  singleton boolean primary key default true check(singleton),
  coin_price_pkr_per_1000 numeric(20,8) not null check(coin_price_pkr_per_1000>0),
  receiver_share_percent numeric(5,2) not null check(receiver_share_percent>0 and receiver_share_percent<=100),
  active boolean not null default false,
  updated_by uuid references public.p2p_profiles(user_id) on delete restrict,
  updated_at timestamptz not null default now()
);
alter table public.p2p_gift_economy_settings enable row level security;
revoke all on public.p2p_gift_economy_settings from public,anon,authenticated;
grant select on public.p2p_gift_economy_settings to authenticated;
create policy p2p_admin_read_gift_economy on public.p2p_gift_economy_settings
for select to authenticated using((select p2p_private.current_role())='admin');

create or replace function public.p2p_admin_set_gift_economy(
  p_coin_price_pkr_per_1000 numeric,
  p_receiver_share_percent numeric,
  p_active boolean
) returns void
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or (select p2p_private.current_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_coin_price_pkr_per_1000 is null or p_coin_price_pkr_per_1000<=0
    or p_receiver_share_percent is null or p_receiver_share_percent<=0 or p_receiver_share_percent>100
    or p_active is null then raise exception 'INVALID_GIFT_ECONOMY_SETTINGS'; end if;
  insert into public.p2p_gift_economy_settings(singleton,coin_price_pkr_per_1000,receiver_share_percent,active,updated_by,updated_at)
  values(true,p_coin_price_pkr_per_1000,p_receiver_share_percent,p_active,v_actor,now())
  on conflict(singleton) do update set coin_price_pkr_per_1000=excluded.coin_price_pkr_per_1000,
    receiver_share_percent=excluded.receiver_share_percent,active=excluded.active,updated_by=v_actor,updated_at=now();
  -- Bootstrap only balances that do not yet have a cost basis. Existing basis
  -- is never rewritten when the Admin changes the future coin price.
  update public.p2p_wallets
    set coin_cost_pkr_remaining=round(coin_available*p_coin_price_pkr_per_1000/1000,8),updated_at=now()
    where coin_available>0 and coin_cost_pkr_remaining=0;
end $$;
revoke all on function public.p2p_admin_set_gift_economy(numeric,numeric,boolean) from public,anon;
grant execute on function public.p2p_admin_set_gift_economy(numeric,numeric,boolean) to authenticated;

-- New coin grants carry the configured cost basis so gifts can be settled
-- from real P2P coin inventory rather than legacy profile balances.
create or replace function public.p2p_admin_grant_coins(
  p_request_key uuid,p_to_user_id uuid,p_amount bigint
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid(); v_id uuid; v_existing public.p2p_ledger%rowtype;
  v_price numeric(20,8):=0;
begin
  if v_actor is null or p_request_key is null or p_to_user_id is null or p_amount is null or p_amount<=0 then raise exception 'INVALID_GRANT'; end if;
  if (select p2p_private.current_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_existing from public.p2p_ledger where request_key=p_request_key;
  if found then
    if v_existing.actor_id=v_actor and v_existing.to_user_id=p_to_user_id and v_existing.asset='coin' and v_existing.kind='coin_issue' and v_existing.amount=p_amount then return v_existing.id; end if;
    raise exception 'IDEMPOTENCY_KEY_REUSED';
  end if;
  select coin_price_pkr_per_1000 into v_price from public.p2p_gift_economy_settings where singleton and active;
  perform 1 from public.p2p_wallets where user_id=p_to_user_id for update;
  if not found then raise exception 'RECIPIENT_P2P_PROFILE_REQUIRED'; end if;
  update public.p2p_wallets set coin_available=coin_available+p_amount,
    coin_cost_pkr_remaining=coin_cost_pkr_remaining+case when v_price>0 then round(p_amount*v_price/1000,8) else 0 end,
    updated_at=now() where user_id=p_to_user_id;
  insert into public.p2p_ledger(request_key,kind,asset,amount,to_user_id,actor_id,metadata)
  values(p_request_key,'coin_issue','coin',p_amount,p_to_user_id,v_actor,jsonb_build_object('reason','admin_grant','cost_basis_pkr_per_1000',v_price))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.p2p_admin_grant_coins(uuid,uuid,bigint) from public,anon;
grant execute on function public.p2p_admin_grant_coins(uuid,uuid,bigint) to authenticated;

-- Transfers preserve cost basis through the agency. When a Sub-Agent transfers
-- sold coins to a normal user, the user's cost basis is the published listing
-- price in PKR-equivalent terms.
create or replace function public.p2p_transfer_coins(p_request_key uuid,p_to_user_id uuid,p_amount bigint)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid(); v_from_role public.p2p_role; v_to_role public.p2p_role;
  v_to_super uuid; v_id uuid; v_existing public.p2p_ledger%rowtype;
  v_from_balance bigint; v_from_cost numeric(30,8); v_move_cost numeric(30,8);
  v_listing record; v_listing_rate numeric(20,8); v_pkr_rate numeric(20,8);
begin
  if v_actor is null or p_request_key is null or p_amount is null or p_amount<=0 or p_to_user_id is null then raise exception 'INVALID_TRANSFER'; end if;
  select * into v_existing from public.p2p_ledger where request_key=p_request_key;
  if found then
    if v_existing.actor_id=v_actor and v_existing.to_user_id=p_to_user_id and v_existing.from_user_id=v_actor
      and v_existing.asset='coin' and v_existing.kind='coin_transfer' and v_existing.amount=p_amount then return v_existing.id; end if;
    raise exception 'IDEMPOTENCY_KEY_REUSED';
  end if;
  select role into v_from_role from public.p2p_profiles where user_id=v_actor and active;
  select role,super_agent_id into v_to_role,v_to_super from public.p2p_profiles where user_id=p_to_user_id and active;
  if v_from_role is null or v_to_role is null or v_actor=p_to_user_id then raise exception 'INVALID_PARTIES'; end if;
  if not ((v_from_role='admin' and v_to_role='super_agent')
    or (v_from_role='super_agent' and v_to_role='sub_agent' and v_to_super=v_actor)
    or (v_from_role='sub_agent' and v_to_role='user')) then raise exception 'HIERARCHY_TRANSFER_FORBIDDEN'; end if;

  perform 1 from public.p2p_wallets where user_id in (v_actor,p_to_user_id) order by user_id for update;
  if (select count(*) from public.p2p_wallets where user_id in (v_actor,p_to_user_id))<>2 then raise exception 'P2P_WALLET_REQUIRED'; end if;
  select coin_available,coin_cost_pkr_remaining into v_from_balance,v_from_cost from public.p2p_wallets where user_id=v_actor;
  if v_from_balance<p_amount then raise exception 'INSUFFICIENT_COINS'; end if;
  v_move_cost:=case when v_from_balance>0 then round(v_from_cost*p_amount/v_from_balance,8) else 0 end;

  if v_from_role='sub_agent' and v_to_role='user' then
    select country_code,currency_code,sell_price_per_1000 into v_listing from public.p2p_agent_listings
      where user_id=v_actor and listed for update;
    if not found then raise exception 'ACTIVE_AGENT_LISTING_REQUIRED'; end if;
    select diamonds_per_fiat_unit into v_listing_rate from public.p2p_exchange_rates where currency_code=v_listing.currency_code and active;
    select diamonds_per_fiat_unit into v_pkr_rate from public.p2p_exchange_rates where currency_code='PKR' and active;
    if v_listing_rate is null or v_pkr_rate is null then raise exception 'COIN_COST_EXCHANGE_RATE_UNAVAILABLE'; end if;
    v_move_cost:=round(p_amount*v_listing.sell_price_per_1000/1000*v_listing_rate/v_pkr_rate,8);
  end if;

  update public.p2p_wallets set coin_available=coin_available-p_amount,
    coin_cost_pkr_remaining=greatest(0,coin_cost_pkr_remaining-case when v_from_balance>0 then round(v_from_cost*p_amount/v_from_balance,8) else 0 end),
    updated_at=now() where user_id=v_actor;
  update public.p2p_wallets set coin_available=coin_available+p_amount,
    coin_cost_pkr_remaining=coin_cost_pkr_remaining+v_move_cost,updated_at=now() where user_id=p_to_user_id;
  insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,to_user_id,actor_id,metadata)
  values(p_request_key,'coin_transfer','coin',p_amount,v_actor,p_to_user_id,v_actor,jsonb_build_object('coin_cost_pkr',v_move_cost))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.p2p_transfer_coins(uuid,uuid,bigint) from public,anon;
grant execute on function public.p2p_transfer_coins(uuid,uuid,bigint) to authenticated;

-- Canonical gift RPC: P2P coins are debited and P2P diamonds are credited in
-- the same transaction. Legacy profile coin/diamond balances are not mutated.
drop function if exists public.send_gift(uuid,uuid,uuid,integer);
create or replace function public.send_gift(
  _room_id uuid,_receiver_id uuid,_gift_id uuid,_quantity integer,_write_message boolean default true
) returns public.gift_sends
language plpgsql security definer set search_path=''
as $function$
declare
  v_sender uuid:=auth.uid(); g public.gifts%rowtype; v_row public.gift_sends;
  v_coins bigint; v_diamonds bigint; v_sender_coins bigint; v_basis_coins bigint;
  v_cost_pkr numeric(30,8); v_coin_cost numeric(30,8); v_share numeric(5,2);
  v_diamond_rate numeric(20,8); v_gift_loop boolean; v_gift_audio_volume numeric;
  v_gift_audio_enabled boolean; v_gift_render_config jsonb;
begin
  perform set_config('app.trusted_definer','on',true);
  if v_sender is null then raise exception 'Not authenticated'; end if;
  if _quantity is null or _quantity<1 or _quantity>100 then raise exception 'Invalid quantity'; end if;
  if _room_id is null or _receiver_id is null or _gift_id is null then raise exception 'Gift parameters are required'; end if;
  if _receiver_id=v_sender then raise exception 'Cannot gift yourself'; end if;
  if not exists(select 1 from public.live_rooms where id=_room_id and status<>'ended') then raise exception 'Room not found or ended'; end if;
  if not exists(select 1 from public.profiles where id=_receiver_id) then raise exception 'Receiver profile not found'; end if;
  select * into g from public.gifts where id=_gift_id and coalesce(is_active,active,true)=true limit 1;
  if not found then raise exception 'Gift not found or inactive'; end if;
  select loop,audio_volume,audio_enabled,render_config into v_gift_loop,v_gift_audio_volume,v_gift_audio_enabled,v_gift_render_config from public.gifts where id=_gift_id;
  v_coins:=(coalesce(g.price_coins,g.price,0)::bigint)*_quantity;
  if v_coins<=0 then raise exception 'Gift has no valid coin price'; end if;

  select coin_price_pkr_per_1000,receiver_share_percent into v_coin_cost,v_share
    from public.p2p_gift_economy_settings where singleton and active;
  if v_coin_cost is null or v_share is null then raise exception 'P2P_GIFT_ECONOMY_NOT_CONFIGURED'; end if;
  select diamonds_per_fiat_unit into v_diamond_rate from public.p2p_exchange_rates where currency_code='PKR' and active;
  if v_diamond_rate is null or v_diamond_rate<=0 then raise exception 'P2P_PKR_DIAMOND_RATE_NOT_CONFIGURED'; end if;

  insert into public.p2p_profiles(user_id,role,active) values(v_sender,'user',true) on conflict(user_id) do nothing;
  insert into public.p2p_profiles(user_id,role,active) values(_receiver_id,'user',true) on conflict(user_id) do nothing;
  perform 1 from public.p2p_profiles where user_id in (v_sender,_receiver_id) order by user_id for update;
  if (select count(*) from public.p2p_profiles where user_id in (v_sender,_receiver_id))<>2 then
    raise exception 'P2P_PROFILE_REQUIRED_FOR_GIFT';
  end if;
  perform 1 from public.p2p_wallets where user_id in (v_sender,_receiver_id) order by user_id for update;
  select coin_available,coin_cost_pkr_remaining into v_sender_coins,v_cost_pkr from public.p2p_wallets where user_id=v_sender;
  if v_sender_coins<v_coins then raise exception 'Insufficient P2P coins'; end if;
  if v_sender_coins<=0 or v_cost_pkr<=0 then raise exception 'P2P_COIN_COST_BASIS_REQUIRED'; end if;
  v_cost_pkr:=round(v_cost_pkr*v_coins/v_sender_coins,8);
  v_diamonds:=greatest(0,round(v_cost_pkr*v_share/100*v_diamond_rate)::bigint);

  update public.p2p_wallets set coin_available=coin_available-v_coins,
    coin_cost_pkr_remaining=greatest(0,coin_cost_pkr_remaining-v_cost_pkr),updated_at=now()
    where user_id=v_sender;
  update public.p2p_wallets set diamond_available=diamond_available+v_diamonds,updated_at=now()
    where user_id=_receiver_id;

  insert into public.gift_sends(
    room_id,sender_id,receiver_id,gift_id,quantity,coins_spent,diamonds_earned,created_at,finalized_at,
    gift_name,gift_emoji,gift_icon,gift_animation,gift_clip_path,gift_clip_type,gift_image_url,
    gift_sound_url,gift_audio_url,gift_priority,gift_duration_ms,gift_loop,gift_audio_volume,
    gift_audio_enabled,gift_render_config
  ) values(
    _room_id,v_sender,_receiver_id,_gift_id,_quantity,v_coins,v_diamonds,now(),now(),
    g.name,g.emoji,g.icon,g.animation,g.clip_path,g.clip_type,g.image_url,g.sound_url,g.audio_url,
    g.priority,g.duration_ms,v_gift_loop,v_gift_audio_volume,v_gift_audio_enabled,v_gift_render_config
  ) returning * into v_row;

  insert into public.p2p_ledger(request_key,kind,asset,amount,from_user_id,to_user_id,actor_id,metadata)
  values(gen_random_uuid(),'gift_spend','coin',v_coins,v_sender,_receiver_id,v_sender,jsonb_build_object('gift_send_id',v_row.id,'gift_id',_gift_id,'quantity',_quantity));
  if v_diamonds>0 then
    insert into public.p2p_ledger(request_key,kind,asset,amount,to_user_id,actor_id,metadata)
    values(gen_random_uuid(),'diamond_earned','diamond',v_diamonds,_receiver_id,v_sender,jsonb_build_object('gift_send_id',v_row.id,'gift_id',_gift_id,'share_percent',v_share));
  end if;

  insert into public.wallet_transactions(user_id,kind,coins_delta,diamonds_delta,ref_type,ref_id,note)
  values(v_sender,'gift_sent',-v_coins,0,'gift',v_row.id,'Sent '||coalesce(g.name,'gift'));
  if v_diamonds>0 then
    insert into public.wallet_transactions(user_id,kind,coins_delta,diamonds_delta,ref_type,ref_id,note)
    values(_receiver_id,'gift_received',0,v_diamonds,'gift',v_row.id,'Received '||coalesce(g.name,'gift'));
  end if;
  perform set_config('app.trusted_definer','off',true);
  return v_row;
exception when others then
  perform set_config('app.trusted_definer','off',true);
  raise;
end;$function$;

revoke all on function public.send_gift(uuid,uuid,uuid,integer,boolean) from public,anon;
grant execute on function public.send_gift(uuid,uuid,uuid,integer,boolean) to authenticated;

notify pgrst,'reload schema';
commit;
