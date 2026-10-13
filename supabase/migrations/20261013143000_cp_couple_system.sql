-- CP Couple System v1
-- Safe, idempotent schema. Coin charges are performed atomically in database RPCs.
create extension if not exists pgcrypto;

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
on conflict (level) do nothing;

create table if not exists public.cp_proposals (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  ring_price bigint not null default 5000 check (ring_price >= 0),
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint cp_proposal_not_self check (sender_id <> receiver_id)
);
create index if not exists cp_proposals_receiver_status_idx on public.cp_proposals(receiver_id,status,created_at desc);
create index if not exists cp_proposals_sender_status_idx on public.cp_proposals(sender_id,status,created_at desc);

create table if not exists public.cp_relations (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid not null references auth.users(id) on delete cascade,
  user2_id uuid not null references auth.users(id) on delete cascade,
  intimacy_score bigint not null default 0 check (intimacy_score >= 0),
  ring_level integer not null default 1 references public.cp_levels_config(level),
  status text not null default 'active' check (status in ('active','divorced')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint cp_relation_not_self check (user1_id <> user2_id),
  constraint cp_relation_pair_order check (user1_id < user2_id)
);
create unique index if not exists cp_one_active_relation_per_user1 on public.cp_relations(user1_id) where status='active';
create unique index if not exists cp_one_active_relation_per_user2 on public.cp_relations(user2_id) where status='active';
create index if not exists cp_relations_user1_active_idx on public.cp_relations(user1_id,status);
create index if not exists cp_relations_user2_active_idx on public.cp_relations(user2_id,status);

alter table public.cp_levels_config enable row level security;
alter table public.cp_proposals enable row level security;
alter table public.cp_relations enable row level security;

drop policy if exists cp_levels_read_authenticated on public.cp_levels_config;
create policy cp_levels_read_authenticated on public.cp_levels_config for select to authenticated using (true);
drop policy if exists cp_proposals_read_participant on public.cp_proposals;
create policy cp_proposals_read_participant on public.cp_proposals for select to authenticated
using (auth.uid() = sender_id or auth.uid() = receiver_id);
drop policy if exists cp_relations_read_participant on public.cp_relations;
create policy cp_relations_read_participant on public.cp_relations for select to authenticated
using (auth.uid() = user1_id or auth.uid() = user2_id);
revoke all on public.cp_levels_config from anon, authenticated;
grant select on public.cp_levels_config to authenticated;
revoke all on public.cp_proposals from anon, authenticated;
grant select on public.cp_proposals to authenticated;
revoke all on public.cp_relations from anon, authenticated;
grant select on public.cp_relations to authenticated;

create or replace function public.cp_send_proposal(p_receiver_id uuid, p_ring_price bigint default 5000)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_sender uuid := auth.uid(); v_id uuid; v_coins bigint;
begin
  if v_sender is null then raise exception 'Authentication required'; end if;
  if p_receiver_id is null or p_receiver_id = v_sender then raise exception 'Invalid receiver'; end if;
  if p_ring_price is null or p_ring_price < 0 or p_ring_price > 10000000 then raise exception 'Invalid ring price'; end if;
  if exists(select 1 from cp_relations r where r.status='active' and (r.user1_id in (v_sender,p_receiver_id) or r.user2_id in (v_sender,p_receiver_id))) then
    raise exception 'One of these users already has an active CP partner';
  end if;
  if exists(select 1 from cp_proposals p where p.sender_id=v_sender and p.receiver_id=p_receiver_id and p.status='pending') then
    raise exception 'A pending proposal already exists';
  end if;
  update public.profiles set coins=coins-p_ring_price where id=v_sender and coalesce(coins,0)>=p_ring_price returning coins into v_coins;
  if not found then raise exception 'Insufficient coins'; end if;
  insert into cp_proposals(sender_id,receiver_id,ring_price) values(v_sender,p_receiver_id,p_ring_price) returning id into v_id;
  return v_id;
end $$;

create or replace function public.cp_respond_proposal(p_proposal_id uuid, p_accept boolean)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := auth.uid(); v_proposal cp_proposals%rowtype; v_relation uuid; v_a uuid; v_b uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_proposal from cp_proposals where id=p_proposal_id for update;
  if not found or v_proposal.receiver_id <> v_user then raise exception 'Proposal not found'; end if;
  if v_proposal.status <> 'pending' then raise exception 'Proposal is no longer pending'; end if;
  if not p_accept then
    update cp_proposals set status='rejected',responded_at=now() where id=p_proposal_id;
    update public.profiles set coins=coalesce(coins,0)+v_proposal.ring_price where id=v_proposal.sender_id;
    return null;
  end if;
  if exists(select 1 from cp_relations r where r.status='active' and (r.user1_id in (v_proposal.sender_id,v_user) or r.user2_id in (v_proposal.sender_id,v_user))) then
    raise exception 'One of these users already has an active CP partner';
  end if;
  v_a := least(v_proposal.sender_id,v_user); v_b := greatest(v_proposal.sender_id,v_user);
  insert into cp_relations(user1_id,user2_id) values(v_a,v_b) returning id into v_relation;
  update cp_proposals set status='accepted',responded_at=now() where id=p_proposal_id;
  return v_relation;
end $$;

create or replace function public.cp_break_relation(p_relation_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  update cp_relations set status='divorced',ended_at=now()
   where id=p_relation_id and status='active' and (user1_id=v_user or user2_id=v_user);
  if not found then raise exception 'Active CP relation not found'; end if;
  update public.profiles set coins=coins-10000 where id=v_user and coalesce(coins,0)>=10000;
  if not found then
    -- Revert the relation update by raising; PostgreSQL rolls back the whole function transaction.
    raise exception 'Divorce requires 10000 coins';
  end if;
  return true;
end $$;

create or replace function public.cp_get_status(p_user_id uuid default auth.uid())
returns table(id uuid,user1_id uuid,user2_id uuid,intimacy_score bigint,ring_level integer,status text,created_at timestamptz,level_name text,min_intimacy bigint,seat_frame_url text,entrance_effect_url text,badge_url text)
language sql stable security invoker set search_path = public, pg_temp as $$
  select r.id,r.user1_id,r.user2_id,r.intimacy_score,r.ring_level,r.status,r.created_at,
         l.name,l.min_intimacy,l.seat_frame_url,l.entrance_effect_url,l.badge_url
  from cp_relations r join cp_levels_config l on l.level=r.ring_level
  where r.status='active' and (r.user1_id=p_user_id or r.user2_id=p_user_id)
    and (auth.uid()=r.user1_id or auth.uid()=r.user2_id)
  limit 1
$$;

-- Update intimacy only from finalized gift records; no speculative gift-table trigger is installed here.
revoke all on function public.cp_send_proposal(uuid,bigint) from public, anon;
revoke all on function public.cp_respond_proposal(uuid,boolean) from public, anon;
revoke all on function public.cp_break_relation(uuid) from public, anon;
revoke all on function public.cp_get_status(uuid) from public, anon;
grant execute on function public.cp_send_proposal(uuid,bigint) to authenticated;
grant execute on function public.cp_respond_proposal(uuid,boolean) to authenticated;
grant execute on function public.cp_break_relation(uuid) to authenticated;
grant execute on function public.cp_get_status(uuid) to authenticated;
