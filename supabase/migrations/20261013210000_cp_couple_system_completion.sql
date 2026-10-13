-- JALWA CP completion: concurrency-safe pairing, rules-aligned costs, gift intimacy and weekly ranking.
-- No LiveKit tables, tokens, rooms, or APIs are modified.
begin;

-- Immutable audit trail for CP intimacy earned during each weekly ranking period.
create table if not exists public.cp_intimacy_events (
  id uuid primary key default gen_random_uuid(),
  relation_id uuid not null references public.cp_relations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  gift_send_id uuid not null unique references public.gift_sends(id) on delete cascade,
  intimacy bigint not null check (intimacy > 0),
  created_at timestamptz not null default now()
);
create index if not exists cp_intimacy_events_week_idx
  on public.cp_intimacy_events(created_at desc, relation_id);
alter table public.cp_intimacy_events enable row level security;
drop policy if exists cp_intimacy_events_participants_read on public.cp_intimacy_events;
create policy cp_intimacy_events_participants_read on public.cp_intimacy_events
  for select to authenticated using (sender_id = auth.uid() or receiver_id = auth.uid());
revoke all on public.cp_intimacy_events from anon, authenticated;
grant select on public.cp_intimacy_events to authenticated;

-- Lock both user IDs in a stable order. A pair-only lock is insufficient when
-- two different proposals try to bind the same user concurrently.
create or replace function public.cp_send_proposal(p_receiver_id uuid, p_ring_price bigint default 13333)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_sender uuid := auth.uid();
  v_sender_coins bigint;
  v_status text;
begin
  if v_sender is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_receiver_id is null or p_receiver_id = v_sender then raise exception 'INVALID_RECEIVER'; end if;
  if p_ring_price is null or p_ring_price <> 13333 then raise exception 'INVALID_PROPOSAL_GIFT_PRICE'; end if;

  if v_sender::text < p_receiver_id::text then
    perform pg_advisory_xact_lock(hashtextextended(v_sender::text, 0));
    perform pg_advisory_xact_lock(hashtextextended(p_receiver_id::text, 0));
  else
    perform pg_advisory_xact_lock(hashtextextended(p_receiver_id::text, 0));
    perform pg_advisory_xact_lock(hashtextextended(v_sender::text, 0));
  end if;

  if exists(select 1 from public.cp_relations r where r.status='active'
    and (r.user1_id in (v_sender,p_receiver_id) or r.user2_id in (v_sender,p_receiver_id))) then
    raise exception 'USER_ALREADY_HAS_CP';
  end if;
  if exists(select 1 from public.cp_proposals p where p.status='pending'
    and ((p.sender_id=v_sender and p.receiver_id=p_receiver_id)
      or (p.sender_id=p_receiver_id and p.receiver_id=v_sender))) then
    raise exception 'PENDING_PROPOSAL_EXISTS';
  end if;

  update public.profiles set coins=coins-p_ring_price, updated_at=now()
    where id=v_sender and coins>=p_ring_price returning coins into v_sender_coins;
  if not found then raise exception 'INSUFFICIENT_COINS'; end if;

  perform set_config('app.trusted_definer','on',true);
  insert into public.wallet_transactions(user_id,kind,coins,coins_delta,balance_coins_after,ref_type,note)
    values(v_sender,'cp_proposal',p_ring_price,-p_ring_price,v_sender_coins,'cp','CP proposal gift');
  perform set_config('app.trusted_definer','off',true);

  insert into public.cp_proposals(sender_id,receiver_id,ring_price)
    values(v_sender,p_receiver_id,p_ring_price) returning status into v_status;
  return jsonb_build_object('ok',true,'coins_remaining',v_sender_coins,'status',v_status,'ring_price',p_ring_price);
end $$;

create or replace function public.cp_respond_proposal(p_proposal_id uuid,p_accept boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_actor uuid:=auth.uid();
  v_prop public.cp_proposals%rowtype;
  v_relation uuid;
  v_user1 uuid;
  v_user2 uuid;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into v_prop from public.cp_proposals where id=p_proposal_id for update;
  if not found then raise exception 'PROPOSAL_NOT_FOUND'; end if;
  if v_prop.receiver_id<>v_actor then raise exception 'NOT_PROPOSAL_RECEIVER' using errcode='42501'; end if;
  if v_prop.status<>'pending' then raise exception 'PROPOSAL_NOT_PENDING'; end if;

  v_user1:=least(v_prop.sender_id,v_prop.receiver_id);
  v_user2:=greatest(v_prop.sender_id,v_prop.receiver_id);
  perform pg_advisory_xact_lock(hashtextextended(v_user1::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(v_user2::text, 0));

  if not p_accept then
    update public.cp_proposals set status='rejected',responded_at=now() where id=p_proposal_id;
    return jsonb_build_object('ok',true,'status','rejected');
  end if;

  if exists(select 1 from public.cp_relations r where r.status='active'
    and (r.user1_id in (v_prop.sender_id,v_prop.receiver_id)
      or r.user2_id in (v_prop.sender_id,v_prop.receiver_id))) then
    raise exception 'USER_ALREADY_HAS_CP';
  end if;

  insert into public.cp_relations(user1_id,user2_id)
    values(v_user1,v_user2) returning id into v_relation;
  update public.cp_proposals set status='accepted',responded_at=now() where id=p_proposal_id;
  return jsonb_build_object('ok',true,'status','accepted','relation_id',v_relation);
end $$;

-- Original rules do not specify a divorce charge, so ending a relationship is free.
create or replace function public.cp_divorce(p_relation_id uuid,p_fee bigint default 0)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_actor uuid:=auth.uid();
  v_rel public.cp_relations%rowtype;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_fee is null or p_fee<>0 then raise exception 'DIVORCE_IS_FREE'; end if;
  select * into v_rel from public.cp_relations
    where id=p_relation_id and status='active' for update;
  if not found then raise exception 'ACTIVE_RELATION_NOT_FOUND'; end if;
  if v_actor not in (v_rel.user1_id,v_rel.user2_id) then
    raise exception 'NOT_RELATION_MEMBER' using errcode='42501';
  end if;
  update public.cp_relations set status='divorced',ended_at=now() where id=p_relation_id;
  return jsonb_build_object('ok',true,'status','divorced','coins_charged',0);
end $$;

-- Only gifts in a category explicitly marked Romantic increase CP intimacy.
-- 1 coin spent = 1 intimacy. The relation's cumulative intimacy never resets.
create or replace function public.cp_apply_romantic_gift_intimacy()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_category text;
  v_relation public.cp_relations%rowtype;
  v_new_score bigint;
  v_new_level integer;
begin
  select lower(coalesce(category,'')) into v_category from public.gifts where id=new.gift_id;
  if v_category not like '%romantic%' or new.coins_spent <= 0 or new.sender_id = new.receiver_id then
    return new;
  end if;

  select * into v_relation from public.cp_relations
    where status='active'
      and user1_id=least(new.sender_id,new.receiver_id)
      and user2_id=greatest(new.sender_id,new.receiver_id)
    for update;
  if not found then return new; end if;

  v_new_score := v_relation.intimacy_score + new.coins_spent;
  select level into v_new_level from public.cp_levels_config
    where min_intimacy <= v_new_score order by min_intimacy desc, level desc limit 1;
  update public.cp_relations
    set intimacy_score=v_new_score,
        ring_level=coalesce(v_new_level,ring_level)
    where id=v_relation.id;

  insert into public.cp_intimacy_events(relation_id,sender_id,receiver_id,gift_send_id,intimacy)
    values(v_relation.id,new.sender_id,new.receiver_id,new.id,new.coins_spent)
    on conflict(gift_send_id) do nothing;
  return new;
end $$;

drop trigger if exists cp_romantic_gift_intimacy_after_insert on public.gift_sends;
create trigger cp_romantic_gift_intimacy_after_insert
  after insert on public.gift_sends
  for each row execute function public.cp_apply_romantic_gift_intimacy();

-- Ranking window follows Saudi Arabia time: Sunday 00:00 through the next Sunday.
create or replace function public.cp_weekly_ranking()
returns table(rank bigint, relation_id uuid, user1_id uuid, user2_id uuid, weekly_intimacy bigint, total_intimacy bigint, level integer)
language sql stable security definer set search_path=public,pg_temp as $$
  with week_start as (
    select (date_trunc('week', (now() at time zone 'Asia/Riyadh') + interval '1 day') - interval '1 day') at time zone 'Asia/Riyadh' as start_at
  ), scores as (
    select r.id, r.user1_id, r.user2_id, r.intimacy_score, r.ring_level,
           coalesce(sum(e.intimacy) filter (where e.created_at >= w.start_at),0)::bigint as weekly
      from public.cp_relations r cross join week_start w
      left join public.cp_intimacy_events e on e.relation_id=r.id
     where r.status='active'
     group by r.id,r.user1_id,r.user2_id,r.intimacy_score,r.ring_level
  )
  select row_number() over(order by weekly desc, intimacy_score desc, id)::bigint,
         id,user1_id,user2_id,weekly,intimacy_score,ring_level
    from scores order by weekly desc,intimacy_score desc,id limit 100
$$;

-- Room-scoped lookup: return only active CP pairs whose two partners both occupy mic seats.
-- Caller must be a member of the requested room. This does not read or modify LiveKit.
create or replace function public.cp_room_seated_pairs(p_room_id uuid)
returns table(relation_id uuid,user1_id uuid,user2_id uuid,intimacy_score bigint,ring_level integer,seat_frame_url text)
language plpgsql stable security definer set search_path=public,pg_temp as $
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.room_members m where m.room_id=p_room_id and m.user_id=auth.uid()) then
    raise exception 'NOT_ROOM_MEMBER' using errcode='42501';
  end if;
  return query
    select r.id,r.user1_id,r.user2_id,r.intimacy_score,r.ring_level,
           (select l.seat_frame_url from public.cp_levels_config l where l.level=r.ring_level)
      from public.cp_relations r
      join public.room_members a on a.room_id=p_room_id and a.user_id=r.user1_id and a.seat_index is not null
      join public.room_members b on b.room_id=p_room_id and b.user_id=r.user2_id and b.seat_index is not null
     where r.status='active'
     order by r.created_at asc;
end $;

revoke all on function public.cp_room_seated_pairs(uuid) from public,anon;
grant execute on function public.cp_room_seated_pairs(uuid) to authenticated;

revoke all on function public.cp_send_proposal(uuid,bigint) from public,anon;
revoke all on function public.cp_respond_proposal(uuid,boolean) from public,anon;
revoke all on function public.cp_divorce(uuid,bigint) from public,anon;
revoke all on function public.cp_weekly_ranking() from public,anon;
grant execute on function public.cp_send_proposal(uuid,bigint) to authenticated;
grant execute on function public.cp_respond_proposal(uuid,boolean) to authenticated;
grant execute on function public.cp_divorce(uuid,bigint) to authenticated;
grant execute on function public.cp_weekly_ranking() to authenticated;
commit;
