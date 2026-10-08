-- Exact purchase-cost basis for gift payouts.
-- Receiver gets 25% of the PKR amount represented by the coins actually spent.
-- Example: Rs50 -> 5000 coins => 1000 coins cost Rs10 => 25% = Rs2.50 => 5 diamonds at Rs0.50/diamond.

create table if not exists public.coin_cost_basis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coins_remaining bigint not null default 0 check (coins_remaining >= 0),
  cost_pkr_remaining numeric(30,8) not null default 0 check (cost_pkr_remaining >= 0),
  updated_at timestamptz not null default now()
);

alter table public.coin_cost_basis enable row level security;
revoke all on table public.coin_cost_basis from anon, authenticated;
grant all on table public.coin_cost_basis to postgres;

insert into public.coin_cost_basis (user_id, coins_remaining, cost_pkr_remaining)
select p.id,p.coins,
 case when coalesce(h.credited_coins,0)>0 and coalesce(p.coins,0)>0
 then round((p.coins::numeric*h.paid_pkr/h.credited_coins),8) else 0 end
from public.profiles p
left join (
 select user_id,sum(credited_coins)::numeric credited_coins,sum(paid_pkr)::numeric paid_pkr from (
  select user_id,coins_total credited_coins,amount_pkr paid_pkr from public.recharge_orders where status='completed'
  union all
  select user_id,coins_expected,amount_pkr from public.card_recharge_orders where status='paid'
  union all
  select rr.user_id,rr.coins_expected,rr.amount_pkr from public.recharge_requests rr
  where rr.status='approved' and (rr.order_id is null or not exists(select 1 from public.recharge_orders ro where ro.id=rr.order_id and ro.status='completed'))
 ) q group by user_id
) h on h.user_id=p.id
on conflict (user_id) do update
set coins_remaining=excluded.coins_remaining,cost_pkr_remaining=excluded.cost_pkr_remaining,updated_at=now();

create or replace function public.record_coin_purchase_cost(_user_id uuid,_coins bigint,_amount_pkr numeric)
returns void language plpgsql security definer set search_path=''
as $function$
begin
 if _user_id is null or coalesce(_coins,0)<=0 or coalesce(_amount_pkr,0)<0 then raise exception 'Invalid coin purchase cost'; end if;
 insert into public.coin_cost_basis(user_id,coins_remaining,cost_pkr_remaining,updated_at)
 values(_user_id,_coins,round(_amount_pkr,8),now())
 on conflict(user_id) do update
 set coins_remaining=public.coin_cost_basis.coins_remaining+excluded.coins_remaining,
     cost_pkr_remaining=public.coin_cost_basis.cost_pkr_remaining+excluded.cost_pkr_remaining,
     updated_at=now();
end;$function$;

revoke execute on function public.record_coin_purchase_cost(uuid,bigint,numeric) from public,anon,authenticated;

create or replace function public.send_gift(_room_id uuid,_receiver_id uuid,_gift_id uuid,_quantity integer,_write_message boolean default true)
returns public.gift_sends language plpgsql security definer set search_path=''
as $function$
declare
 v_sender uuid:=auth.uid(); g public.gifts%rowtype; v_row public.gift_sends;
 v_coins bigint; v_diamonds bigint; v_sender_coins bigint; v_receiver_diamonds bigint;
 v_gift_loop boolean; v_gift_audio_volume numeric; v_gift_audio_enabled boolean;
 v_gift_render_config jsonb; v_diamond_price_pkr numeric; v_cost_pkr numeric; v_basis_coins bigint;
begin
 perform set_config('app.trusted_definer','on',true);
 if v_sender is null then raise exception 'Not authenticated'; end if;
 if _quantity is null or _quantity<1 or _quantity>100 then raise exception 'Invalid quantity'; end if;
 if _room_id is null or _receiver_id is null or _gift_id is null then raise exception 'Gift parameters are required'; end if;
 if _receiver_id=v_sender then raise exception 'Cannot gift yourself'; end if;
 select * into g from public.gifts where id=_gift_id and coalesce(is_active,active,true)=true limit 1;
 if not found then raise exception 'Gift not found or inactive'; end if;
 if not exists(select 1 from public.live_rooms where id=_room_id and status<>'ended') then raise exception 'Room not found or ended'; end if;
 if not exists(select 1 from public.profiles where id=_receiver_id) then raise exception 'Receiver profile not found'; end if;
 select loop,audio_volume,audio_enabled,render_config into v_gift_loop,v_gift_audio_volume,v_gift_audio_enabled,v_gift_render_config from public.gifts where id=_gift_id;
 v_coins=(coalesce(g.price_coins,g.price,0)::bigint)*_quantity;
 if v_coins<=0 then raise exception 'Gift has no valid coin price'; end if;
 select diamond_price_pkr into v_diamond_price_pkr from public.app_settings where id='global' limit 1;
 if coalesce(v_diamond_price_pkr,0)<=0 then raise exception 'Diamond rate is not configured'; end if;
 select coins into v_sender_coins from public.profiles where id=v_sender for update;
 if not found then raise exception 'Sender profile not found'; end if;
 if coalesce(v_sender_coins,0)<v_coins then raise exception 'Insufficient coins'; end if;
 select coins_remaining,cost_pkr_remaining into v_basis_coins,v_cost_pkr from public.coin_cost_basis where user_id=v_sender for update;
 if not found or coalesce(v_basis_coins,0)<v_coins then
   raise exception 'Coin purchase value is not available for this balance. Please recharge coins again before gifting.';
 end if;
 v_cost_pkr=round((v_cost_pkr*v_coins)/nullif(v_basis_coins,0),8);
 v_diamonds=round((v_cost_pkr*0.25)/v_diamond_price_pkr)::bigint;
 update public.profiles set coins=coins-v_coins,updated_at=now() where id=v_sender returning coins into v_sender_coins;
 update public.coin_cost_basis set coins_remaining=coins_remaining-v_coins,cost_pkr_remaining=greatest(0,round(cost_pkr_remaining-v_cost_pkr,8)),updated_at=now() where user_id=v_sender;
 update public.profiles set diamonds=coalesce(diamonds,0)+v_diamonds,updated_at=now() where id=_receiver_id returning diamonds into v_receiver_diamonds;
 insert into public.gift_sends(room_id,sender_id,receiver_id,gift_id,quantity,coins_spent,diamonds_earned,created_at,finalized_at,gift_name,gift_emoji,gift_icon,gift_animation,gift_clip_path,gift_clip_type,gift_image_url,gift_sound_url,gift_audio_url,gift_priority,gift_duration_ms,gift_loop,gift_audio_volume,gift_audio_enabled,gift_render_config)
 values(_room_id,v_sender,_receiver_id,_gift_id,_quantity,v_coins,v_diamonds,now(),now(),g.name,g.emoji,g.icon,g.animation,g.clip_path,g.clip_type,g.image_url,g.sound_url,g.audio_url,g.priority,g.duration_ms,v_gift_loop,v_gift_audio_volume,v_gift_audio_enabled,v_gift_render_config)
 returning * into v_row;
 insert into public.wallet_transactions(user_id,kind,coins_delta,diamonds_delta,balance_coins_after,ref_type,ref_id,note)
 values(v_sender,'gift_sent',-v_coins,0,v_sender_coins,'gift',v_row.id,'Sent '||coalesce(g.name,'gift'));
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

revoke execute on function public.send_gift(uuid,uuid,uuid,integer,boolean) from public,anon;
grant execute on function public.send_gift(uuid,uuid,uuid,integer,boolean) to authenticated;

create or replace function public.approve_recharge(_request_id uuid,_admin_note text default null)
returns void language plpgsql security definer set search_path=''
as $function$
declare _req public.recharge_requests%rowtype;
begin
 if not public.is_admin(auth.uid()) then raise exception 'Admins only'; end if;
 select * into _req from public.recharge_requests where id=_request_id for update;
 if not found then raise exception 'Request not found'; end if;
 if _req.status<>'pending' then raise exception 'Already %',_req.status; end if;
 update public.recharge_requests set status='approved',admin_note=coalesce(_admin_note,admin_note),reviewed_by=auth.uid(),reviewed_at=now() where id=_request_id;
 perform set_config('app.trusted_definer','on',true);
 update public.profiles set coins=coins+_req.coins_expected,updated_at=now() where id=_req.user_id;
 perform public.record_coin_purchase_cost(_req.user_id,_req.coins_expected,_req.amount_pkr);
 perform set_config('app.trusted_definer','off',true);
 insert into public.wallet_transactions(user_id,kind,coins_delta,ref_type,ref_id,note) values(_req.user_id,'recharge',_req.coins_expected,'recharge_request',_req.id,'Recharge approved by admin');
 insert into public.notifications(user_id,kind,title,body,entity_type,entity_id) values(_req.user_id,'recharge_approved','Recharge approved 🎉','Rs '||_req.amount_pkr::text||' recharge approved. '||_req.coins_expected::text||' coins credited.','recharge_request',_req.id);
 insert into public.admin_logs(action,target,details) values('recharge_approved',_req.id::text,jsonb_build_object('user_id',_req.user_id,'coins',_req.coins_expected,'amount_pkr',_req.amount_pkr,'method',_req.method,'admin_note',_admin_note));
end;$function$;

create or replace function public.credit_card_recharge(_order_id uuid,_provider_status text,_provider_reference text default null,_provider_payload jsonb default '{}'::jsonb)
returns public.card_recharge_orders language plpgsql security definer set search_path=''
as $function$
declare r public.card_recharge_orders; new_balance bigint;
begin
 select * into r from public.card_recharge_orders where id=_order_id for update;
 if not found then raise exception 'card recharge order not found'; end if;
 if r.status='paid' then return r; end if;
 if lower(coalesce(_provider_status,'')) not in ('completed','paid','success','succeeded','tracker_ended') then
  update public.card_recharge_orders set status=case when lower(coalesce(_provider_status,'')) in ('failed','rejected','cancelled','canceled') then 'failed' else status end,provider_status=_provider_status,provider_reference=coalesce(_provider_reference,provider_reference),metadata=coalesce(_provider_payload,'{}'::jsonb),updated_at=now() where id=r.id returning * into r; return r;
 end if;
 update public.profiles set coins=coins+r.coins_expected,updated_at=now() where id=r.user_id returning coins into new_balance;
 if not found then raise exception 'wallet profile not found'; end if;
 perform public.record_coin_purchase_cost(r.user_id,r.coins_expected,r.amount_pkr);
 update public.card_recharge_orders set status='paid',provider_status=_provider_status,provider_reference=coalesce(_provider_reference,provider_reference),metadata=coalesce(_provider_payload,'{}'::jsonb),paid_at=now(),updated_at=now() where id=r.id returning * into r;
 insert into public.wallet_transactions(user_id,kind,coins_delta,balance_coins_after,ref_type,ref_id,note) values(r.user_id,'recharge',r.coins_expected,new_balance,'card_recharge',r.id,'Card recharge approved ('||r.provider||')'); return r;
end;$function$;

create or replace function public.gateway_credit_recharge_order(_order_id uuid,_provider text,_provider_txn text,_status text,_raw jsonb default '{}'::jsonb)
returns table(success boolean,message text,new_balance bigint) language plpgsql security definer set search_path=''
as $function$
declare o public.recharge_orders%rowtype; b bigint; v_status text:=lower(trim(coalesce(_status,''))); v_provider text:=lower(trim(coalesce(_provider,''))); v_txn text:=trim(coalesce(_provider_txn,''));
begin
 if _order_id is null or v_provider='' then return query select false,'Invalid payment callback'::text,0::bigint; return; end if;
 select * into o from public.recharge_orders where id=_order_id for update;
 if not found then return query select false,'Order not found'::text,0::bigint; return; end if;
 if lower(trim(coalesce(o.gateway_provider,''))) is distinct from v_provider then return query select false,'Provider mismatch'::text,0::bigint; return; end if;
 if o.status='completed' then select coins into b from public.profiles where id=o.user_id; return query select true,'Already credited'::text,coalesce(b,0); return; end if;
 if v_status not in ('success','failed','failure') then return query select false,('Payment status: '||v_status)::text,0::bigint; return; end if;
 if v_txn<>'' and exists(select 1 from public.recharge_orders x where x.gateway_provider=v_provider and x.gateway_transaction_ref=v_txn and x.id<>o.id) then return query select false,'Provider transaction already used'::text,0::bigint; return; end if;
 update public.recharge_orders set gateway_transaction_ref=case when v_txn<>'' then v_txn else gateway_transaction_ref end,gateway_status=v_status,gateway_payload=coalesce(_raw,'{}'::jsonb) where id=o.id;
 if v_status in ('failed','failure') then update public.recharge_orders set status='failed' where id=o.id and status<>'completed'; return query select false,('Payment status: '||v_status)::text,0::bigint; return; end if;
 update public.profiles set coins=coins+o.coins_total,updated_at=now() where id=o.user_id returning coins into b;
 if b is null then raise exception 'Profile not found'; end if;
 perform public.record_coin_purchase_cost(o.user_id,o.coins_total,o.amount_pkr);
 update public.recharge_orders set status='completed',completed_at=now(),gateway_status='success' where id=o.id;
 insert into public.wallet_transactions(user_id,kind,coins_delta,balance_coins_after,ref_type,ref_id,note) values(o.user_id,'recharge',o.coins_total,b,'recharge_order',o.id,'Recharge via '||o.gateway_provider);
 return query select true,'Payment confirmed and coins credited'::text,b;
end;$function$;

create or replace function public.recharge_verify_otp(_order_id uuid,_otp text)
returns table(success boolean,coins_credited integer,new_balance bigint,message text)
language plpgsql security definer set search_path=''
as $function$
declare o public.recharge_orders%rowtype; b bigint;
begin
 if auth.uid() is null then raise exception 'Auth required'; end if;
 select * into o from public.recharge_orders where id=_order_id and user_id=auth.uid() for update;
 if not found then raise exception 'Order not found'; end if;
 if o.gateway_provider is not null then return query select false,0,0::bigint,'Gateway payment orders must be confirmed by the payment provider'::text; return; end if;
 if o.status<>'pending_otp' then return query select false,0,0::bigint,'Order already processed'::text; return; end if;
 if now()>o.otp_expires_at then update public.recharge_orders set status='expired' where id=o.id; return query select false,0,0::bigint,'OTP expired'::text; return; end if;
 if o.otp_attempts>=5 then update public.recharge_orders set status='failed' where id=o.id; return query select false,0,0::bigint,'Too many attempts'::text; return; end if;
 if o.otp_code<>_otp then update public.recharge_orders set otp_attempts=otp_attempts+1 where id=o.id; return query select false,0,0::bigint,'Invalid OTP'::text; return; end if;
 update public.profiles set coins=coins+o.coins_total,updated_at=now() where id=o.user_id returning coins into b;
 perform public.record_coin_purchase_cost(o.user_id,o.coins_total,o.amount_pkr);
 update public.recharge_orders set status='completed',completed_at=now() where id=o.id;
 insert into public.wallet_transactions(user_id,kind,coins_delta,balance_coins_after,ref_type,ref_id,note) values(o.user_id,'recharge',o.coins_total,b,'recharge_order',o.id,'Recharge via '||o.method::text||' (auto)');
 return query select true,o.coins_total,b,('Success! '||o.coins_total||' coins credited')::text;
end;$function$;
