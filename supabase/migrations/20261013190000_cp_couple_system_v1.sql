-- JALWA CP Couple System v1
-- Apply through Supabase migration tooling / SQL Editor. No LiveKit changes.
begin;

create table if not exists public.cp_levels_config (
  level integer primary key check (level between 1 and 100),
  name text not null,
  min_intimacy bigint not null default 0 check (min_intimacy >= 0),
  seat_frame_url text,
  entrance_effect_url text,
  badge_url text,
  updated_at timestamptz not null default now()
);

insert into public.cp_levels_config(level,name,min_intimacy)
values (1,'Bronze',0),(2,'Silver',5000),(3,'Gold',20000),(4,'Diamond',50000)
on conflict(level) do nothing;

create table if not exists public.cp_proposals (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  ring_price bigint not null default 5000 check (ring_price >= 0),
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled','expired')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint cp_proposal_not_self check (sender_id <> receiver_id)
);
create unique index if not exists cp_one_pending_proposal_per_pair
on public.cp_proposals(least(sender_id,receiver_id), greatest(sender_id,receiver_id))
where status='pending';

create table if not exists public.cp_relations (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid not null references auth.users(id) on delete cascade,
  user2_id uuid not null references auth.users(id) on delete cascade,
  intimacy_score bigint not null default 0 check (intimacy_score >= 0),
  ring_level integer not null default 1 references public.cp_levels_config(level),
  status text not null default 'active' check (status in ('active','divorced')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint cp_relation_not_self check(user1_id <> user2_id),
  constraint cp_relation_sorted check(user1_id < user2_id)
);
create unique index if not exists cp_one_active_relation_per_user1 on public.cp_relations(user1_id) where status='active';
create unique index if not exists cp_one_active_relation_per_user2 on public.cp_relations(user2_id) where status='active';
-- Cross-column uniqueness: enforced transactionally by the RPC's advisory lock.

alter table public.cp_levels_config enable row level security;
alter table public.cp_proposals enable row level security;
alter table public.cp_relations enable row level security;

drop policy if exists cp_levels_read_authenticated on public.cp_levels_config;
create policy cp_levels_read_authenticated on public.cp_levels_config
for select to authenticated using (true);
drop policy if exists cp_levels_admin_write on public.cp_levels_config;
create policy cp_levels_admin_write on public.cp_levels_config
for all to authenticated
using (public.has_role(auth.uid(),'admin'::public.app_role) or public.has_role(auth.uid(),'super_admin'::public.app_role))
with check (public.has_role(auth.uid(),'admin'::public.app_role) or public.has_role(auth.uid(),'super_admin'::public.app_role));

drop policy if exists cp_proposals_read_participants on public.cp_proposals;
create policy cp_proposals_read_participants on public.cp_proposals
for select to authenticated using (sender_id=auth.uid() or receiver_id=auth.uid());
drop policy if exists cp_relations_read_participants on public.cp_relations;
create policy cp_relations_read_participants on public.cp_relations
for select to authenticated using (user1_id=auth.uid() or user2_id=auth.uid());

revoke all on public.cp_proposals from anon, authenticated;
grant select on public.cp_proposals to authenticated;
revoke all on public.cp_relations from anon, authenticated;
grant select on public.cp_relations to authenticated;
revoke all on public.cp_levels_config from anon;
grant select on public.cp_levels_config to authenticated;
grant insert, update, delete on public.cp_levels_config to authenticated;

create or replace function public.cp_send_proposal(p_receiver_id uuid, p_ring_price bigint default 5000)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_sender uuid := auth.uid(); v_sender_coins bigint; v_status text;
begin
 if v_sender is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_receiver_id is null or p_receiver_id=v_sender then raise exception 'INVALID_RECEIVER'; end if;
 if p_ring_price is null or p_ring_price < 0 or p_ring_price > 1000000 then raise exception 'INVALID_RING_PRICE'; end if;
 perform pg_advisory_xact_lock(hashtextextended(least(v_sender::text,p_receiver_id::text)||':'||greatest(v_sender::text,p_receiver_id::text),0));
 if exists(select 1 from public.cp_relations r where r.status='active' and (r.user1_id in (v_sender,p_receiver_id) or r.user2_id in (v_sender,p_receiver_id))) then raise exception 'USER_ALREADY_HAS_CP'; end if;
 if exists(select 1 from public.cp_proposals p where p.status='pending' and ((p.sender_id=v_sender and p.receiver_id=p_receiver_id) or (p.sender_id=p_receiver_id and p.receiver_id=v_sender))) then raise exception 'PENDING_PROPOSAL_EXISTS'; end if;
 update public.profiles set coins=coins-p_ring_price,updated_at=now() where id=v_sender and coins>=p_ring_price returning coins into v_sender_coins;
 if not found then raise exception 'INSUFFICIENT_COINS'; end if;
 perform set_config('app.trusted_definer','on',true);
 insert into public.wallet_transactions(user_id,kind,coins,coins_delta,balance_coins_after,ref_type,note)
 values(v_sender,'cp_proposal',p_ring_price,-p_ring_price,v_sender_coins,'cp','CP proposal ring');
 perform set_config('app.trusted_definer','off',true);
 insert into public.cp_proposals(sender_id,receiver_id,ring_price) values(v_sender,p_receiver_id,p_ring_price) returning status into v_status;
 return jsonb_build_object('ok',true,'coins_remaining',v_sender_coins,'status',v_status);
end $$;

create or replace function public.cp_respond_proposal(p_proposal_id uuid,p_accept boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=auth.uid(); v_prop public.cp_proposals%rowtype; v_relation uuid; v_user1 uuid; v_user2 uuid;
begin
 if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 select * into v_prop from public.cp_proposals where id=p_proposal_id for update;
 if not found then raise exception 'PROPOSAL_NOT_FOUND'; end if;
 if v_prop.receiver_id<>v_actor then raise exception 'NOT_PROPOSAL_RECEIVER' using errcode='42501'; end if;
 if v_prop.status<>'pending' then raise exception 'PROPOSAL_NOT_PENDING'; end if;
 perform pg_advisory_xact_lock(hashtextextended(least(v_prop.sender_id::text,v_prop.receiver_id::text)||':'||greatest(v_prop.sender_id::text,v_prop.receiver_id::text),0));
 if not p_accept then
   update public.cp_proposals set status='rejected',responded_at=now() where id=p_proposal_id;
   return jsonb_build_object('ok',true,'status','rejected');
 end if;
 if exists(select 1 from public.cp_relations r where r.status='active' and (r.user1_id in (v_prop.sender_id,v_prop.receiver_id) or r.user2_id in (v_prop.sender_id,v_prop.receiver_id))) then raise exception 'USER_ALREADY_HAS_CP'; end if;
 v_user1:=least(v_prop.sender_id,v_prop.receiver_id); v_user2:=greatest(v_prop.sender_id,v_prop.receiver_id);
 insert into public.cp_relations(user1_id,user2_id) values(v_user1,v_user2) returning id into v_relation;
 update public.cp_proposals set status='accepted',responded_at=now() where id=p_proposal_id;
 return jsonb_build_object('ok',true,'status','accepted','relation_id',v_relation);
end $$;

create or replace function public.cp_divorce(p_relation_id uuid,p_fee bigint default 10000)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=auth.uid(); v_rel public.cp_relations%rowtype; v_balance bigint;
begin
 if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_fee is null or p_fee<0 or p_fee>1000000 then raise exception 'INVALID_FEE'; end if;
 select * into v_rel from public.cp_relations where id=p_relation_id and status='active' for update;
 if not found then raise exception 'ACTIVE_RELATION_NOT_FOUND'; end if;
 if v_actor not in (v_rel.user1_id,v_rel.user2_id) then raise exception 'NOT_RELATION_MEMBER' using errcode='42501'; end if;
 update public.profiles set coins=coins-p_fee,updated_at=now() where id=v_actor and coins>=p_fee returning coins into v_balance;
 if not found then raise exception 'INSUFFICIENT_COINS'; end if;
 perform set_config('app.trusted_definer','on',true);
 insert into public.wallet_transactions(user_id,kind,coins,coins_delta,balance_coins_after,ref_type,ref_id,note)
 values(v_actor,'cp_divorce',p_fee,-p_fee,v_balance,'cp',p_relation_id,'CP divorce fee');
 perform set_config('app.trusted_definer','off',true);
 update public.cp_relations set status='divorced',ended_at=now() where id=p_relation_id;
 return jsonb_build_object('ok',true,'coins_remaining',v_balance);
end $$;

revoke all on function public.cp_send_proposal(uuid,bigint) from public,anon;
revoke all on function public.cp_respond_proposal(uuid,boolean) from public,anon;
revoke all on function public.cp_divorce(uuid,bigint) from public,anon;
grant execute on function public.cp_send_proposal(uuid,bigint) to authenticated;
grant execute on function public.cp_respond_proposal(uuid,boolean) to authenticated;
grant execute on function public.cp_divorce(uuid,bigint) to authenticated;
commit;
