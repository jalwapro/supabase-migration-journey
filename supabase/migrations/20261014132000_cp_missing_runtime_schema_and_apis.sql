-- Repair missing CP runtime schema and APIs used by the Couple Space and Ring Selector.
-- This is additive and does not alter LiveKit or voice transport.
begin;

create table if not exists public.cp_rings_config (
  id text primary key,
  name text not null,
  price bigint not null default 0 check (price >= 0),
  icon_url text not null default '',
  description text,
  broadcast_banner boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cp_rings_config enable row level security;
drop policy if exists cp_rings_config_read_active on public.cp_rings_config;
create policy cp_rings_config_read_active on public.cp_rings_config
  for select to authenticated using (is_active);
revoke all on public.cp_rings_config from anon, authenticated;
grant select on public.cp_rings_config to authenticated;

insert into public.cp_rings_config(id,name,price,icon_url,description,broadcast_banner,sort_order)
values
 ('silver_ring','Silver Love Ring',13333,'','A classic promise to begin your couple journey',false,1),
 ('gold_ring','Royal Gold Ring',49999,'/images/cp/icon_vpt_apply_cp.png','A golden promise for a growing bond',true,2),
 ('diamond_ring','Eternal Diamond Ring',99999,'/images/cp/icon_vpt_cp_rank_double_heart.png','A brilliant promise for a lasting romance',true,3)
on conflict(id) do update set
 name=excluded.name, price=excluded.price, icon_url=excluded.icon_url,
 description=excluded.description, broadcast_banner=excluded.broadcast_banner,
 sort_order=excluded.sort_order, is_active=true, updated_at=now();

alter table public.cp_proposals add column if not exists ring_id text references public.cp_rings_config(id);
alter table public.cp_relations add column if not exists ring_id text references public.cp_rings_config(id);
alter table public.cp_relations add column if not exists space_bio text;

create table if not exists public.cp_daily_tasks_config (
  task_key text primary key,
  title text not null,
  intimacy_reward integer not null default 10 check (intimacy_reward > 0),
  description text,
  verification_type text not null check (verification_type in ('romantic_gift','exclusive_gift','two_gifts')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.cp_daily_tasks_config enable row level security;
drop policy if exists cp_daily_tasks_config_read_active on public.cp_daily_tasks_config;
create policy cp_daily_tasks_config_read_active on public.cp_daily_tasks_config
  for select to authenticated using (is_active);
revoke all on public.cp_daily_tasks_config from anon, authenticated;
grant select on public.cp_daily_tasks_config to authenticated;

insert into public.cp_daily_tasks_config(task_key,title,intimacy_reward,description,verification_type,sort_order)
values
 ('romantic_gift','Share a Romantic Gift',50,'Send at least one qualifying romantic gift to your CP today.','romantic_gift',1),
 ('exclusive_gift','Send an Exclusive CP Gift',100,'Send an exclusive couple gift to your partner today.','exclusive_gift',2),
 ('two_gifts','Keep the Romance Going',150,'Send two or more qualifying gifts to your CP today.','two_gifts',3)
on conflict(task_key) do update set
 title=excluded.title, intimacy_reward=excluded.intimacy_reward,
 description=excluded.description, verification_type=excluded.verification_type,
 is_active=true, sort_order=excluded.sort_order, updated_at=now();

create table if not exists public.cp_daily_task_completions (
  id uuid primary key default gen_random_uuid(),
  relation_id uuid not null references public.cp_relations(id) on delete cascade,
  task_key text not null references public.cp_daily_tasks_config(task_key),
  completion_date date not null,
  completed_by uuid not null references auth.users(id) on delete cascade,
  intimacy_awarded integer not null check (intimacy_awarded > 0),
  created_at timestamptz not null default now(),
  constraint cp_daily_task_once_per_relation unique(relation_id,task_key,completion_date)
);
create index if not exists cp_daily_task_completions_relation_day_idx
  on public.cp_daily_task_completions(relation_id,completion_date desc);
alter table public.cp_daily_task_completions enable row level security;
drop policy if exists cp_daily_task_completions_participant_read on public.cp_daily_task_completions;
create policy cp_daily_task_completions_participant_read on public.cp_daily_task_completions
  for select to authenticated using (
    exists(select 1 from public.cp_relations r
      where r.id=relation_id and auth.uid() in (r.user1_id,r.user2_id))
  );
revoke all on public.cp_daily_task_completions from anon,authenticated;
grant select on public.cp_daily_task_completions to authenticated;

create table if not exists public.cp_diary_posts (
  id uuid primary key default gen_random_uuid(),
  relation_id uuid not null references public.cp_relations(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (length(trim(content)) between 1 and 1000),
  image_url text,
  created_at timestamptz not null default now()
);
create index if not exists cp_diary_posts_relation_created_idx
  on public.cp_diary_posts(relation_id,created_at desc);
alter table public.cp_diary_posts enable row level security;
drop policy if exists cp_diary_posts_participant_read on public.cp_diary_posts;
create policy cp_diary_posts_participant_read on public.cp_diary_posts
  for select to authenticated using (
    exists(select 1 from public.cp_relations r
      where r.id=relation_id and auth.uid() in (r.user1_id,r.user2_id))
  );
drop policy if exists cp_diary_posts_active_participant_insert on public.cp_diary_posts;
create policy cp_diary_posts_active_participant_insert on public.cp_diary_posts
  for insert to authenticated with check (
    author_id=auth.uid() and exists(select 1 from public.cp_relations r
      where r.id=relation_id and r.status='active' and auth.uid() in (r.user1_id,r.user2_id))
  );
drop policy if exists cp_diary_posts_author_delete on public.cp_diary_posts;
create policy cp_diary_posts_author_delete on public.cp_diary_posts
  for delete to authenticated using (author_id=auth.uid());
revoke all on public.cp_diary_posts from anon,authenticated;
grant select,insert,delete on public.cp_diary_posts to authenticated;

create or replace function public.cp_get_space_details(p_user_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path=public,pg_temp
as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_user_id is null or p_user_id<>auth.uid() then raise exception 'NOT_RELATION_MEMBER' using errcode='42501'; end if;
  select jsonb_build_object(
    'relation_id',r.id,
    'days_together',greatest(0,current_date-(r.created_at at time zone 'Asia/Riyadh')::date),
    'intimacy_score',r.intimacy_score,
    'level',coalesce(level_cfg.level,r.ring_level,1),
    'level_name',coalesce(level_cfg.name,'Bronze'),
    'seat_frame_url',level_cfg.seat_frame_url,
    'badge_url',level_cfg.badge_url,
    'ring_name',coalesce(ring_cfg.name,'Love Ring'),
    'ring_icon',coalesce(ring_cfg.icon_url,''),
    'space_bio',r.space_bio,
    'started_at',r.created_at,
    'partner',jsonb_build_object('id',partner.id,'username',partner.username,'avatar',partner.avatar,'user_code',partner.user_code),
    'me',jsonb_build_object('id',me.id,'username',me.username,'avatar',me.avatar,'user_code',me.user_code)
  ) into v_result
  from public.cp_relations r
  join public.profiles me on me.id=p_user_id
  join public.profiles partner on partner.id=case when r.user1_id=p_user_id then r.user2_id else r.user1_id end
  left join public.cp_levels_config level_cfg on level_cfg.level=r.ring_level
  left join public.cp_rings_config ring_cfg on ring_cfg.id=r.ring_id
  where r.status='active' and p_user_id in (r.user1_id,r.user2_id)
  limit 1;
  return v_result;
end;
$$;
revoke all on function public.cp_get_space_details(uuid) from public,anon;
grant execute on function public.cp_get_space_details(uuid) to authenticated;

create or replace function public.cp_complete_daily_task(p_task_key text)
returns jsonb
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare
  v_user uuid:=auth.uid();
  v_relation public.cp_relations%rowtype;
  v_task public.cp_daily_tasks_config%rowtype;
  v_today date:=(now() at time zone 'Asia/Riyadh')::date;
  v_start timestamptz;
  v_end timestamptz;
  v_evidence bigint:=0;
  v_new_score bigint;
  v_new_level integer;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into v_relation from public.cp_relations
    where status='active' and v_user in (user1_id,user2_id) for update;
  if not found then raise exception 'NO_ACTIVE_CP'; end if;
  select * into v_task from public.cp_daily_tasks_config
    where task_key=p_task_key and is_active=true;
  if not found then raise exception 'TASK_NOT_FOUND'; end if;

  v_start:=v_today::timestamp at time zone 'Asia/Riyadh';
  v_end:=(v_today+1)::timestamp at time zone 'Asia/Riyadh';

  if v_task.verification_type='romantic_gift' then
    select count(*) into v_evidence from public.cp_intimacy_events e
      where e.relation_id=v_relation.id and e.created_at>=v_start and e.created_at<v_end;
  elsif v_task.verification_type='exclusive_gift' then
    select count(*) into v_evidence from public.cp_exclusive_gift_events e
      where e.relation_id=v_relation.id and e.created_at>=v_start and e.created_at<v_end;
  elsif v_task.verification_type='two_gifts' then
    select count(*) into v_evidence from (
      select e.id from public.cp_intimacy_events e where e.relation_id=v_relation.id and e.created_at>=v_start and e.created_at<v_end
      union all
      select e.id from public.cp_exclusive_gift_events e where e.relation_id=v_relation.id and e.created_at>=v_start and e.created_at<v_end
    ) gift_events;
  end if;
  if v_evidence < case when v_task.verification_type='two_gifts' then 2 else 1 end then
    raise exception 'TASK_REQUIREMENT_NOT_MET' using hint='Complete the task in the app first, then claim its reward.';
  end if;

  insert into public.cp_daily_task_completions(relation_id,task_key,completion_date,completed_by,intimacy_awarded)
    values(v_relation.id,v_task.task_key,v_today,v_user,v_task.intimacy_reward);
  v_new_score:=v_relation.intimacy_score+v_task.intimacy_reward;
  select cfg.level into v_new_level from public.cp_levels_config cfg
    where cfg.min_intimacy<=v_new_score order by cfg.min_intimacy desc,cfg.level desc limit 1;
  update public.cp_relations set intimacy_score=v_new_score,ring_level=coalesce(v_new_level,ring_level)
    where id=v_relation.id;
  return jsonb_build_object('success',true,'task_key',v_task.task_key,'intimacy_awarded',v_task.intimacy_reward,
    'new_intimacy',v_new_score,'new_level',coalesce(v_new_level,v_relation.ring_level));
end;
$$;
revoke all on function public.cp_complete_daily_task(text) from public,anon;
grant execute on function public.cp_complete_daily_task(text) to authenticated;

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
  select * into v_ring from public.cp_rings_config where id=p_ring_id and is_active=true;
  if not found then raise exception 'RING_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(v_sender::text,p_receiver_id::text),0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(v_sender::text,p_receiver_id::text),0));
  if exists(select 1 from public.cp_relations r where r.status='active' and (r.user1_id in (v_sender,p_receiver_id) or r.user2_id in (v_sender,p_receiver_id))) then
    raise exception 'USER_ALREADY_HAS_CP';
  end if;
  if exists(select 1 from public.cp_proposals p where p.status='pending' and ((p.sender_id=v_sender and p.receiver_id=p_receiver_id) or (p.sender_id=p_receiver_id and p.receiver_id=v_sender))) then
    raise exception 'PENDING_PROPOSAL_EXISTS';
  end if;
  select coalesce(sum(e.intimacy),0)::bigint into v_prelink
    from public.cp_prelink_intimacy_events e
    where (e.sender_id=v_sender and e.receiver_id=p_receiver_id) or (e.sender_id=p_receiver_id and e.receiver_id=v_sender);
  v_fee:=case when v_prelink>=v_ring.price then 0 else v_ring.price end;
  update public.profiles set coins=coins-v_fee,updated_at=now()
    where id=v_sender and coins>=v_fee returning coins into v_balance;
  if not found then raise exception 'INSUFFICIENT_COINS'; end if;
  if v_fee>0 then
    perform set_config('app.trusted_definer','on',true);
    insert into public.wallet_transactions(user_id,kind,coins,coins_delta,balance_coins_after,ref_type,note)
      values(v_sender,'cp_proposal',v_fee,-v_fee,v_balance,'cp',format('CP proposal ring: %s',v_ring.name));
    perform set_config('app.trusted_definer','off',true);
  end if;
  insert into public.cp_proposals(sender_id,receiver_id,ring_price,ring_id)
    values(v_sender,p_receiver_id,v_ring.price,v_ring.id) returning id into v_proposal;
  return jsonb_build_object('success',true,'proposal_id',v_proposal,'ring_name',v_ring.name,'fee_paid',v_fee,
    'waived',v_fee=0,'coins_remaining',v_balance,'status','pending');
end;
$$;
revoke all on function public.cp_send_proposal_v2(uuid,text,text) from public,anon;
grant execute on function public.cp_send_proposal_v2(uuid,text,text) to authenticated;

create or replace function public.cp_respond_proposal_v2(p_proposal_id uuid,p_accept boolean)
returns jsonb
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare
  v_actor uuid:=auth.uid();
  v_proposal public.cp_proposals%rowtype;
  v_ring public.cp_rings_config%rowtype;
  v_relation uuid;
  v_sender_name text;
  v_sender_avatar text;
  v_receiver_name text;
  v_receiver_avatar text;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into v_proposal from public.cp_proposals where id=p_proposal_id for update;
  if not found then raise exception 'PROPOSAL_NOT_FOUND'; end if;
  if v_proposal.receiver_id<>v_actor then raise exception 'NOT_PROPOSAL_RECEIVER' using errcode='42501'; end if;
  if v_proposal.status<>'pending' then raise exception 'PROPOSAL_NOT_PENDING'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(v_proposal.sender_id::text,v_proposal.receiver_id::text),0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(v_proposal.sender_id::text,v_proposal.receiver_id::text),0));
  if not p_accept then
    update public.cp_proposals set status='rejected',responded_at=now() where id=p_proposal_id;
    return jsonb_build_object('success',true,'status','rejected');
  end if;
  if exists(select 1 from public.cp_relations r where r.status='active' and (r.user1_id in (v_proposal.sender_id,v_proposal.receiver_id) or r.user2_id in (v_proposal.sender_id,v_proposal.receiver_id))) then
    raise exception 'USER_ALREADY_HAS_CP';
  end if;
  insert into public.cp_relations(user1_id,user2_id,ring_id)
    values(least(v_proposal.sender_id,v_proposal.receiver_id),greatest(v_proposal.sender_id,v_proposal.receiver_id),v_proposal.ring_id)
    returning id into v_relation;
  update public.cp_proposals set status='accepted',responded_at=now() where id=p_proposal_id;
  select username,avatar into v_sender_name,v_sender_avatar from public.profiles where id=v_proposal.sender_id;
  select username,avatar into v_receiver_name,v_receiver_avatar from public.profiles where id=v_proposal.receiver_id;
  select * into v_ring from public.cp_rings_config where id=v_proposal.ring_id;
  if coalesce(v_ring.broadcast_banner,false) then
    insert into public.cp_broadcasts(type,title,message,sender_name,sender_avatar,receiver_name,receiver_avatar,icon_url)
    values('new_cp','A New JALWA Couple!',format('%s and %s are now CP partners! ❤️',coalesce(v_sender_name,'Partner'),coalesce(v_receiver_name,'Partner')),
      v_sender_name,v_sender_avatar,v_receiver_name,v_receiver_avatar,v_ring.icon_url);
  end if;
  return jsonb_build_object('success',true,'status','accepted','relation_id',v_relation,'ring_name',v_ring.name);
end;
$$;
revoke all on function public.cp_respond_proposal_v2(uuid,boolean) from public,anon;
grant execute on function public.cp_respond_proposal_v2(uuid,boolean) to authenticated;

create or replace function public.cp_cancel_breakup_request(p_request_id uuid)
returns jsonb
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_actor uuid:=auth.uid(); v_id uuid;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  update public.cp_breakup_requests
    set status='cancelled',responded_at=now()
    where id=p_request_id and requester_id=v_actor and status='pending'
    returning id into v_id;
  if not found then raise exception 'BREAKUP_REQUEST_NOT_CANCELLABLE'; end if;
  return jsonb_build_object('success',true,'status','cancelled','request_id',v_id);
end;
$$;
revoke all on function public.cp_cancel_breakup_request(uuid) from public,anon;
grant execute on function public.cp_cancel_breakup_request(uuid) to authenticated;

commit;