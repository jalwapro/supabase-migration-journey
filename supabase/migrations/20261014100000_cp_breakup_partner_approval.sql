-- CP breakup requires approval from the other partner.
-- This migration does not modify LiveKit or any voice-room transport APIs.
begin;

create table if not exists public.cp_breakup_requests (
  id uuid primary key default gen_random_uuid(),
  relation_id uuid not null references public.cp_relations(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint cp_breakup_request_distinct_users check (requester_id <> recipient_id)
);
create index if not exists cp_breakup_requests_recipient_pending_idx
  on public.cp_breakup_requests(recipient_id, created_at desc) where status='pending';
create unique index if not exists cp_breakup_requests_one_pending_per_relation
  on public.cp_breakup_requests(relation_id) where status='pending';

alter table public.cp_breakup_requests enable row level security;
drop policy if exists cp_breakup_requests_participant_read on public.cp_breakup_requests;
create policy cp_breakup_requests_participant_read on public.cp_breakup_requests
  for select to authenticated using (
    requester_id = auth.uid() or recipient_id = auth.uid()
  );
revoke all on public.cp_breakup_requests from public, anon, authenticated;
grant select on public.cp_breakup_requests to authenticated;

create or replace function public.cp_request_breakup(p_relation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_actor uuid := auth.uid();
  v_rel public.cp_relations%rowtype;
  v_recipient uuid;
  v_request_id uuid;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into v_rel from public.cp_relations
   where id=p_relation_id and status='active' for update;
  if not found then raise exception 'ACTIVE_RELATION_NOT_FOUND'; end if;
  if v_actor not in (v_rel.user1_id, v_rel.user2_id) then
    raise exception 'NOT_RELATION_MEMBER' using errcode='42501';
  end if;
  if exists(select 1 from public.cp_breakup_requests
    where relation_id=v_rel.id and status='pending') then
    raise exception 'BREAKUP_REQUEST_ALREADY_PENDING';
  end if;
  v_recipient := case when v_actor=v_rel.user1_id then v_rel.user2_id else v_rel.user1_id end;
  insert into public.cp_breakup_requests(relation_id, requester_id, recipient_id)
    values(v_rel.id, v_actor, v_recipient) returning id into v_request_id;
  return jsonb_build_object('ok',true,'status','pending','request_id',v_request_id,'recipient_id',v_recipient);
end $$;

create or replace function public.cp_respond_breakup_request(p_request_id uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_actor uuid := auth.uid();
  v_req public.cp_breakup_requests%rowtype;
  v_rel public.cp_relations%rowtype;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into v_req from public.cp_breakup_requests where id=p_request_id for update;
  if not found then raise exception 'BREAKUP_REQUEST_NOT_FOUND'; end if;
  if v_req.recipient_id <> v_actor then
    raise exception 'NOT_BREAKUP_REQUEST_RECIPIENT' using errcode='42501';
  end if;
  if v_req.status <> 'pending' then raise exception 'BREAKUP_REQUEST_NOT_PENDING'; end if;
  select * into v_rel from public.cp_relations where id=v_req.relation_id and status='active' for update;
  if not found then
    update public.cp_breakup_requests set status='cancelled', responded_at=now() where id=v_req.id;
    raise exception 'ACTIVE_RELATION_NOT_FOUND';
  end if;
  if p_accept then
    update public.cp_relations set status='divorced', ended_at=now() where id=v_rel.id;
    update public.cp_breakup_requests set status='accepted', responded_at=now() where id=v_req.id;
    return jsonb_build_object('ok',true,'status','accepted','relation_id',v_rel.id);
  end if;
  update public.cp_breakup_requests set status='rejected', responded_at=now() where id=v_req.id;
  return jsonb_build_object('ok',true,'status','rejected','relation_id',v_rel.id);
end $$;

-- Disable unilateral divorce: all CP endings must pass through the partner-approval flow.
create or replace function public.cp_divorce(p_relation_id uuid, p_fee bigint default 0)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  raise exception 'PARTNER_APPROVAL_REQUIRED'
    using hint='Create a CP breakup request and wait for the other partner to accept.';
end $$;

revoke all on function public.cp_request_breakup(uuid) from public, anon;
revoke all on function public.cp_respond_breakup_request(uuid, boolean) from public, anon;
revoke all on function public.cp_divorce(uuid, bigint) from public, anon;
grant execute on function public.cp_request_breakup(uuid) to authenticated;
grant execute on function public.cp_respond_breakup_request(uuid, boolean) to authenticated;
grant execute on function public.cp_divorce(uuid, bigint) to authenticated;
commit;
