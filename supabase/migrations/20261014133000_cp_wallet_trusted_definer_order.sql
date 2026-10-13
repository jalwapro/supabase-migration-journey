-- CP wallet operations must set the trusted-definer marker before changing profile balances.
-- The profiles protection trigger otherwise restores the old balance and silently defeats the debit.
begin;

create or replace function public.cp_send_exclusive_gift(p_gift_id text, p_message text default null)
returns jsonb
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare
  v_sender uuid:=auth.uid();
  v_rel public.cp_relations%rowtype;
  v_partner uuid;
  v_gift public.cp_exclusive_gifts_config%rowtype;
  v_balance bigint;
  v_sender_name text;
  v_sender_avatar text;
  v_partner_name text;
  v_partner_avatar text;
  v_new_intimacy bigint;
  v_new_level integer;
  v_event_id uuid;
begin
  if v_sender is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_gift_id is null or length(p_gift_id)>100 then raise exception 'INVALID_GIFT_ID'; end if;
  if p_message is not null and length(p_message)>250 then raise exception 'MESSAGE_TOO_LONG'; end if;

  select * into v_rel from public.cp_relations
    where status='active' and (user1_id=v_sender or user2_id=v_sender) for update;
  if not found then raise exception 'NO_ACTIVE_CP'; end if;
  v_partner:=case when v_rel.user1_id=v_sender then v_rel.user2_id else v_rel.user1_id end;

  select * into v_gift from public.cp_exclusive_gifts_config where id=p_gift_id and is_active=true;
  if not found then raise exception 'GIFT_NOT_FOUND'; end if;
  if coalesce(v_rel.ring_level,1)<v_gift.required_cp_level then raise exception 'CP_LEVEL_TOO_LOW'; end if;

  select username,avatar into v_sender_name,v_sender_avatar from public.profiles where id=v_sender;
  select username,avatar into v_partner_name,v_partner_avatar from public.profiles where id=v_partner;

  perform set_config('app.trusted_definer','on',true);
  perform set_config('app.coin_operation','cp_exclusive_gift',true);
  update public.profiles set coins=coins-v_gift.price,updated_at=now()
    where id=v_sender and coins>=v_gift.price returning coins into v_balance;
  if not found then raise exception 'INSUFFICIENT_COINS'; end if;

  insert into public.wallet_transactions(user_id,kind,coins,coins_delta,balance_coins_after,ref_type,note)
  values(v_sender,'cp_exclusive_gift',v_gift.price,-v_gift.price,v_balance,'cp',
    format('CP gift: %s to %s',v_gift.name,coalesce(v_partner_name,'partner')));
  perform set_config('app.trusted_definer','off',true);
  perform set_config('app.coin_operation','',true);

  insert into public.cp_exclusive_gift_events(relation_id,sender_id,receiver_id,gift_id,coins_spent,intimacy)
  values(v_rel.id,v_sender,v_partner,p_gift_id,v_gift.price,v_gift.intimacy_points)
  returning id into v_event_id;

  update public.cp_relations set intimacy_score=intimacy_score+v_gift.intimacy_points
    where id=v_rel.id returning intimacy_score into v_new_intimacy;
  select level into v_new_level from public.cp_levels_config
    where min_intimacy<=v_new_intimacy order by min_intimacy desc,level desc limit 1;
  if v_new_level is not null then
    update public.cp_relations set ring_level=v_new_level where id=v_rel.id;
  else
    v_new_level:=v_rel.ring_level;
  end if;

  if v_gift.broadcast_threshold or v_gift.price>=20000 then
    insert into public.cp_broadcasts(type,title,message,sender_name,sender_avatar,receiver_name,receiver_avatar,icon_url)
    values('gift',format('Romantic Gift: %s',v_gift.name),
      format('%s presented %s to %s! Intimacy +%s%s',
        coalesce(v_sender_name,'A partner'),v_gift.name,coalesce(v_partner_name,'their beloved'),
        v_gift.intimacy_points,case when nullif(trim(p_message),'') is null then '' else ' — '||left(trim(p_message),250) end),
      v_sender_name,v_sender_avatar,v_partner_name,v_partner_avatar,v_gift.icon_url);
  end if;

  return jsonb_build_object('success',true,'event_id',v_event_id,'gift_name',v_gift.name,
    'coins_spent',v_gift.price,'coins_remaining',v_balance,'points_added',v_gift.intimacy_points,
    'new_intimacy',v_new_intimacy,'new_level',v_new_level,'animation_url',v_gift.animation_url,
    'partner_name',v_partner_name);
end;
$$;
revoke all on function public.cp_send_exclusive_gift(text,text) from public,anon;
grant execute on function public.cp_send_exclusive_gift(text,text) to authenticated;

create or replace function public.cp_send_proposal(p_receiver_id uuid,p_ring_price bigint default 13333)
returns jsonb
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare
  v_sender uuid:=auth.uid();
  v_sender_coins bigint;
  v_status text;
  v_prelink_spend bigint;
  v_actual_price bigint;
begin
  if v_sender is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_receiver_id is null or p_receiver_id=v_sender then raise exception 'INVALID_RECEIVER'; end if;
  if v_sender::text<p_receiver_id::text then
    perform pg_advisory_xact_lock(hashtextextended(v_sender::text,0));
    perform pg_advisory_xact_lock(hashtextextended(p_receiver_id::text,0));
  else
    perform pg_advisory_xact_lock(hashtextextended(p_receiver_id::text,0));
    perform pg_advisory_xact_lock(hashtextextended(v_sender::text,0));
  end if;
  if exists(select 1 from public.cp_relations r where r.status='active'
    and (r.user1_id in (v_sender,p_receiver_id) or r.user2_id in (v_sender,p_receiver_id))) then
    raise exception 'USER_ALREADY_HAS_CP';
  end if;
  if exists(select 1 from public.cp_proposals p where p.status='pending'
    and ((p.sender_id=v_sender and p.receiver_id=p_receiver_id) or (p.sender_id=p_receiver_id and p.receiver_id=v_sender))) then
    raise exception 'PENDING_PROPOSAL_EXISTS';
  end if;

  select coalesce(sum(e.intimacy),0)::bigint into v_prelink_spend
  from public.cp_prelink_intimacy_events e
  where (e.sender_id=v_sender and e.receiver_id=p_receiver_id) or (e.sender_id=p_receiver_id and e.receiver_id=v_sender);
  v_actual_price:=case when v_prelink_spend>=13333 then 0 else 13333 end;

  perform set_config('app.trusted_definer','on',true);
  perform set_config('app.coin_operation','cp_proposal',true);
  update public.profiles set coins=coins-v_actual_price,updated_at=now()
    where id=v_sender and coins>=v_actual_price returning coins into v_sender_coins;
  if not found then raise exception 'INSUFFICIENT_COINS'; end if;
  if v_actual_price>0 then
    insert into public.wallet_transactions(user_id,kind,coins,coins_delta,balance_coins_after,ref_type,note)
    values(v_sender,'cp_proposal',v_actual_price,-v_actual_price,v_sender_coins,'cp','CP proposal gift');
  end if;
  perform set_config('app.trusted_definer','off',true);
  perform set_config('app.coin_operation','',true);

  insert into public.cp_proposals(sender_id,receiver_id,ring_price)
    values(v_sender,p_receiver_id,v_actual_price) returning status into v_status;
  return jsonb_build_object('ok',true,'coins_remaining',v_sender_coins,'status',v_status,
    'ring_price',v_actual_price,'prelink_romantic_gift_coins',v_prelink_spend,'proposal_fee_waived',v_actual_price=0);
end;
$$;
revoke all on function public.cp_send_proposal(uuid,bigint) from public,anon;
grant execute on function public.cp_send_proposal(uuid,bigint) to authenticated;

create or replace function public.cp_send_proposal_v2(p_receiver_id uuid,p_ring_id text default 'silver_ring',p_message text default 'Will you be my CP in JALWA? ❤️')
returns jsonb
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare
  v_sender uuid:=auth.uid();
  v_ring public.cp_rings_config%rowtype;
  v_prelink bigint:=0;
  v_fee bigint;
  v_balance bigint;
  v_proposal uuid;
begin
  if v_sender is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_receiver_id is null or p_receiver_id=v_sender then raise exception 'INVALID_RECEIVER'; end if;
  if p_message is not null and length(p_message)>240 then raise exception 'MESSAGE_TOO_LONG'; end if;
  select * into v_ring from public.cp_rings_config where id=p_ring_id and is_active=true;
  if not found then raise exception 'RING_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(v_sender::text,p_receiver_id::text),0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(v_sender::text,p_receiver_id::text),0));
  if exists(select 1 from public.cp_relations r where r.status='active'
    and (r.user1_id in (v_sender,p_receiver_id) or r.user2_id in (v_sender,p_receiver_id))) then
    raise exception 'USER_ALREADY_HAS_CP';
  end if;
  if exists(select 1 from public.cp_proposals p where p.status='pending'
    and ((p.sender_id=v_sender and p.receiver_id=p_receiver_id) or (p.sender_id=p_receiver_id and p.receiver_id=v_sender))) then
    raise exception 'PENDING_PROPOSAL_EXISTS';
  end if;
  select coalesce(sum(e.intimacy),0)::bigint into v_prelink from public.cp_prelink_intimacy_events e
    where (e.sender_id=v_sender and e.receiver_id=p_receiver_id) or (e.sender_id=p_receiver_id and e.receiver_id=v_sender);
  v_fee:=case when v_prelink>=v_ring.price then 0 else v_ring.price end;

  perform set_config('app.trusted_definer','on',true);
  perform set_config('app.coin_operation','cp_proposal',true);
  update public.profiles set coins=coins-v_fee,updated_at=now()
    where id=v_sender and coins>=v_fee returning coins into v_balance;
  if not found then raise exception 'INSUFFICIENT_COINS'; end if;
  if v_fee>0 then
    insert into public.wallet_transactions(user_id,kind,coins,coins_delta,balance_coins_after,ref_type,note)
      values(v_sender,'cp_proposal',v_fee,-v_fee,v_balance,'cp',format('CP proposal ring: %s',v_ring.name));
  end if;
  perform set_config('app.trusted_definer','off',true);
  perform set_config('app.coin_operation','',true);

  insert into public.cp_proposals(sender_id,receiver_id,ring_price,ring_id)
    values(v_sender,p_receiver_id,v_ring.price,v_ring.id) returning id into v_proposal;
  return jsonb_build_object('success',true,'proposal_id',v_proposal,'ring_name',v_ring.name,
    'fee_paid',v_fee,'waived',v_fee=0,'coins_remaining',v_balance,'status','pending');
end;
$$;
revoke all on function public.cp_send_proposal_v2(uuid,text,text) from public,anon;
grant execute on function public.cp_send_proposal_v2(uuid,text,text) to authenticated;

commit;