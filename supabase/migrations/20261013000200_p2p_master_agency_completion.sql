-- Completion patch for the isolated JALWA P2P Master-Agency v1.
-- Additive only: no legacy wallet, gift, or LiveKit objects are changed.
begin;

revoke execute on function public.p2p_admin_issue_coins(uuid,bigint) from authenticated;

create or replace function public.p2p_ensure_profile()
returns public.p2p_profiles
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid := auth.uid(); v_profile public.p2p_profiles%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.p2p_profiles(user_id,role,active)
  values(v_user,'user',true)
  on conflict(user_id) do nothing;
  select * into v_profile from public.p2p_profiles where user_id=v_user;
  if not found then raise exception 'P2P_PROFILE_SETUP_FAILED'; end if;
  return v_profile;
end $$;
revoke all on function public.p2p_ensure_profile() from public,anon;
grant execute on function public.p2p_ensure_profile() to authenticated;

-- A directory policy exposes only active Sub-Agent identities so users can select
-- an agent; financial balances and payout details remain private.
create policy p2p_active_subagent_directory on public.p2p_profiles
for select to authenticated
using(role='sub_agent' and active=true);
create policy p2p_admin_read_all_profiles on public.p2p_profiles
for select to authenticated
using((select p2p_private.current_role())='admin');
create policy p2p_admin_read_all_wallets on public.p2p_wallets
for select to authenticated
using((select p2p_private.current_role())='admin');
create policy p2p_admin_read_all_rates on public.p2p_exchange_rates
for select to authenticated
using((select p2p_private.current_role())='admin');
create policy p2p_admin_read_all_ledger on public.p2p_ledger
for select to authenticated
using((select p2p_private.current_role())='admin');

create or replace function public.p2p_admin_assign_role(
  p_user_id uuid, p_role public.p2p_role, p_super_agent_id uuid default null, p_display_name text default null
) returns void language plpgsql security definer set search_path=''
as $
begin
  if (select p2p_private.current_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_role='admin' then raise exception 'ADMIN_ROLE_MUST_BE_BOOTSTRAPPED_OUT_OF_BAND'; end if;
  if p_role='sub_agent' then
    if p_super_agent_id is null or not exists(select 1 from public.p2p_profiles where user_id=p_super_agent_id and role='super_agent' and active) then
      raise exception 'ACTIVE_SUPER_AGENT_REQUIRED';
    end if;
  elsif p_super_agent_id is not null then
    raise exception 'ONLY_SUB_AGENT_HAS_PARENT';
  end if;
  insert into public.p2p_profiles(user_id,role,super_agent_id,display_name)
  values(p_user_id,p_role,p_super_agent_id,nullif(trim(p_display_name),''))
  on conflict(user_id) do update set role=excluded.role,super_agent_id=excluded.super_agent_id,display_name=excluded.display_name,updated_at=now();
end $;
revoke all on function public.p2p_admin_assign_role(uuid,public.p2p_role,uuid,text) from public,anon;
grant execute on function public.p2p_admin_assign_role(uuid,public.p2p_role,uuid,text) to authenticated;

create or replace function public.p2p_admin_grant_coins(
  p_request_key uuid, p_to_user_id uuid, p_amount bigint
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_id uuid; v_existing public.p2p_ledger%rowtype;
begin
  if v_actor is null or p_request_key is null or p_to_user_id is null or p_amount is null or p_amount<=0 then
    raise exception 'INVALID_GRANT';
  end if;
  if (select p2p_private.current_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_existing from public.p2p_ledger where request_key=p_request_key;
  if found then
    if v_existing.actor_id=v_actor and v_existing.to_user_id=p_to_user_id and v_existing.asset='coin' and v_existing.kind='coin_issue' and v_existing.amount=p_amount then return v_existing.id; end if;
    raise exception 'IDEMPOTENCY_KEY_REUSED';
  end if;
  perform 1 from public.p2p_wallets where user_id=p_to_user_id for update;
  if not found then raise exception 'RECIPIENT_P2P_PROFILE_REQUIRED'; end if;
  update public.p2p_wallets set coin_available=coin_available+p_amount,updated_at=now() where user_id=p_to_user_id;
  insert into public.p2p_ledger(request_key,kind,asset,amount,to_user_id,actor_id,metadata)
  values(p_request_key,'coin_issue','coin',p_amount,p_to_user_id,v_actor,jsonb_build_object('reason','admin_grant'))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.p2p_admin_grant_coins(uuid,uuid,bigint) from public,anon;
grant execute on function public.p2p_admin_grant_coins(uuid,uuid,bigint) to authenticated;

create or replace function public.p2p_admin_grant_diamonds(
  p_request_key uuid, p_user_id uuid, p_amount bigint, p_source text default 'admin_manual_grant'
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_id uuid; v_existing public.p2p_ledger%rowtype;
begin
  if v_actor is null or p_request_key is null or p_user_id is null or p_amount is null or p_amount<=0 then raise exception 'INVALID_GRANT'; end if;
  if (select p2p_private.current_role()) is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_existing from public.p2p_ledger where request_key=p_request_key;
  if found then
    if v_existing.actor_id=v_actor and v_existing.to_user_id=p_user_id and v_existing.asset='diamond' and v_existing.kind='diamond_earned' and v_existing.amount=p_amount then return v_existing.id; end if;
    raise exception 'IDEMPOTENCY_KEY_REUSED';
  end if;
  perform 1 from public.p2p_wallets where user_id=p_user_id for update;
  if not found then raise exception 'RECIPIENT_P2P_PROFILE_REQUIRED'; end if;
  update public.p2p_wallets set diamond_available=diamond_available+p_amount,updated_at=now() where user_id=p_user_id;
  insert into public.p2p_ledger(request_key,kind,asset,amount,to_user_id,actor_id,metadata)
  values(p_request_key,'diamond_earned','diamond',p_amount,p_user_id,v_actor,jsonb_build_object('source',left(coalesce(p_source,'admin_manual_grant'),120),'reason','admin_grant'))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.p2p_admin_grant_diamonds(uuid,uuid,bigint,text) from public,anon;
grant execute on function public.p2p_admin_grant_diamonds(uuid,uuid,bigint,text) to authenticated;

-- Admin-only select access for agency operations. All balance writes remain RPC-only.
create policy p2p_admin_read_all_withdrawals on public.p2p_diamond_withdrawals
for select to authenticated
using((select p2p_private.current_role())='admin');

commit;
