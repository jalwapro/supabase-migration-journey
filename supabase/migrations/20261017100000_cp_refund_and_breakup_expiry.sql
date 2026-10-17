-- CP proposal refunds and breakup grace period. Does not modify LiveKit.
begin;

alter table public.cp_proposals
  add column if not exists fee_paid bigint not null default 0;
alter table public.cp_proposals
  drop constraint if exists cp_proposals_fee_paid_check;
alter table public.cp_proposals
  add constraint cp_proposals_fee_paid_check check (fee_paid >= 0);

-- Recover charged amounts for legacy proposals when their original ledger entry can be
-- matched unambiguously by sender and timestamp. Unmatched entries remain zero to avoid minting coins.
with candidates as (
  select p.id as proposal_id,
         wt.id as transaction_id,
         greatest(0, -wt.coins_delta) as amount,
         row_number() over (
           partition by p.id
           order by abs(extract(epoch from (wt.created_at - p.created_at)))
         ) as proposal_rank,
         row_number() over (
           partition by wt.id
           order by abs(extract(epoch from (wt.created_at - p.created_at)))
         ) as transaction_rank
  from public.cp_proposals p
  join public.wallet_transactions wt
    on wt.user_id = p.sender_id
   and wt.kind = 'cp_proposal'
   and wt.coins_delta < 0
   and wt.created_at between p.created_at - interval '2 minutes'
                         and p.created_at + interval '2 minutes'
  where p.fee_paid = 0
)
update public.cp_proposals p
set fee_paid = c.amount
from candidates c
where c.proposal_id = p.id
  and c.proposal_rank = 1
  and c.transaction_rank = 1;

create or replace function public.cp_refund_proposal_fee(p_proposal_id uuid, p_reason text)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_proposal public.cp_proposals%rowtype;
  v_balance bigint;
begin
  select * into v_proposal
  from public.cp_proposals
  where id = p_proposal_id
  for update;

  if not found then raise exception 'PROPOSAL_NOT_FOUND'; end if;
  if v_proposal.status not in ('rejected', 'expired') then
    raise exception 'PROPOSAL_NOT_REFUNDABLE';
  end if;

  if exists (
    select 1 from public.wallet_transactions
    where kind = 'cp_proposal_refund'
      and ref_type = 'cp_proposal_refund'
      and ref_id = v_proposal.id
  ) then
    return 0;
  end if;

  if coalesce(v_proposal.fee_paid, 0) <= 0 then
    return 0;
  end if;

  update public.profiles
  set coins = coins + v_proposal.fee_paid, updated_at = now()
  where id = v_proposal.sender_id
  returning coins into v_balance;

  if not found then raise exception 'PROPOSAL_SENDER_PROFILE_NOT_FOUND'; end if;

  perform set_config('app.trusted_definer', 'on', true);
  insert into public.wallet_transactions
    (user_id, kind, coins, coins_delta, balance_coins_after, ref_type, ref_id, note)
  values
    (v_proposal.sender_id, 'cp_proposal_refund', v_proposal.fee_paid,
     v_proposal.fee_paid, v_balance, 'cp_proposal_refund', v_proposal.id,
     case when p_reason = 'expired'
       then 'CP Proposal Expired: Refund'
       else 'CP Proposal Rejected: Refund'
     end);
  perform set_config('app.trusted_definer', 'off', true);

  return v_proposal.fee_paid;
end;
$$;
revoke all on function public.cp_refund_proposal_fee(uuid, text) from public, anon, authenticated;

create or replace function public.cp_send_proposal_v2(
  p_receiver_id uuid,
  p_ring_id text default 'silver_ring',
  p_message text default 'Will you be my CP in JALWA? ❤️'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sender uuid := auth.uid();
  v_ring public.cp_rings_config%rowtype;
  v_prelink bigint := 0;
  v_fee bigint;
  v_balance bigint;
  v_proposal uuid;
begin
  if v_sender is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_receiver_id is null or p_receiver_id = v_sender then raise exception 'INVALID_RECEIVER'; end if;

  select * into v_ring from public.cp_rings_config where id = p_ring_id and is_active = true;
  if not found then raise exception 'RING_NOT_FOUND'; end if;

  perform pg_advisory_xact_lock(hashtextextended(least(v_sender::text, p_receiver_id::text), 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(v_sender::text, p_receiver_id::text), 0));

  if exists (
    select 1 from public.cp_relations r
    where r.status = 'active'
      and (r.user1_id in (v_sender, p_receiver_id) or r.user2_id in (v_sender, p_receiver_id))
  ) then raise exception 'USER_ALREADY_HAS_CP'; end if;

  if exists (
    select 1 from public.cp_proposals p
    where p.status = 'pending'
      and ((p.sender_id = v_sender and p.receiver_id = p_receiver_id)
        or (p.sender_id = p_receiver_id and p.receiver_id = v_sender))
  ) then raise exception 'PENDING_PROPOSAL_EXISTS'; end if;

  select coalesce(sum(e.intimacy), 0)::bigint into v_prelink
  from public.cp_prelink_intimacy_events e
  where (e.sender_id = v_sender and e.receiver_id = p_receiver_id)
     or (e.sender_id = p_receiver_id and e.receiver_id = v_sender);

  v_fee := case when v_prelink >= v_ring.price then 0 else v_ring.price end;

  insert into public.cp_proposals(sender_id, receiver_id, ring_price, ring_id, fee_paid)
  values (v_sender, p_receiver_id, v_ring.price, v_ring.id, 0)
  returning id into v_proposal;

  update public.profiles
  set coins = coins - v_fee, updated_at = now()
  where id = v_sender and coins >= v_fee
  returning coins into v_balance;
  if not found then raise exception 'INSUFFICIENT_COINS'; end if;

  update public.cp_proposals set fee_paid = v_fee where id = v_proposal;

  if v_fee > 0 then
    perform set_config('app.trusted_definer', 'on', true);
    insert into public.wallet_transactions
      (user_id, kind, coins, coins_delta, balance_coins_after, ref_type, ref_id, note)
    values
      (v_sender, 'cp_proposal', v_fee, -v_fee, v_balance, 'cp', v_proposal,
       format('CP proposal ring: %s', v_ring.name));
    perform set_config('app.trusted_definer', 'off', true);
  end if;

  return jsonb_build_object(
    'success', true, 'proposal_id', v_proposal, 'ring_name', v_ring.name,
    'fee_paid', v_fee, 'waived', v_fee = 0, 'coins_remaining', v_balance, 'status', 'pending'
  );
end;
$$;
revoke all on function public.cp_send_proposal_v2(uuid, text, text) from public, anon;
grant execute on function public.cp_send_proposal_v2(uuid, text, text) to authenticated;

create or replace function public.cp_respond_proposal_v2(p_proposal_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_proposal public.cp_proposals%rowtype;
  v_ring public.cp_rings_config%rowtype;
  v_relation uuid;
  v_sender_name text;
  v_sender_avatar text;
  v_receiver_name text;
  v_receiver_avatar text;
  v_refund bigint := 0;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into v_proposal from public.cp_proposals where id = p_proposal_id for update;
  if not found then raise exception 'PROPOSAL_NOT_FOUND'; end if;
  if v_proposal.receiver_id <> v_actor then raise exception 'NOT_PROPOSAL_RECEIVER' using errcode = '42501'; end if;
  if v_proposal.status <> 'pending' then raise exception 'PROPOSAL_NOT_PENDING'; end if;

  perform pg_advisory_xact_lock(hashtextextended(least(v_proposal.sender_id::text, v_proposal.receiver_id::text), 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(v_proposal.sender_id::text, v_proposal.receiver_id::text), 0));

  if not p_accept then
    update public.cp_proposals set status = 'rejected', responded_at = now() where id = p_proposal_id;
    v_refund := public.cp_refund_proposal_fee(p_proposal_id, 'rejected');
    return jsonb_build_object('success', true, 'status', 'rejected', 'refunded_coins', v_refund);
  end if;

  if exists (
    select 1 from public.cp_relations r
    where r.status = 'active'
      and (r.user1_id in (v_proposal.sender_id, v_proposal.receiver_id)
        or r.user2_id in (v_proposal.sender_id, v_proposal.receiver_id))
  ) then raise exception 'USER_ALREADY_HAS_CP'; end if;

  insert into public.cp_relations(user1_id, user2_id, ring_id)
  values (least(v_proposal.sender_id, v_proposal.receiver_id),
          greatest(v_proposal.sender_id, v_proposal.receiver_id), v_proposal.ring_id)
  returning id into v_relation;

  update public.cp_proposals set status = 'accepted', responded_at = now() where id = p_proposal_id;
  select username, avatar into v_sender_name, v_sender_avatar from public.profiles where id = v_proposal.sender_id;
  select username, avatar into v_receiver_name, v_receiver_avatar from public.profiles where id = v_proposal.receiver_id;
  select * into v_ring from public.cp_rings_config where id = v_proposal.ring_id;

  if coalesce(v_ring.broadcast_banner, false) then
    insert into public.cp_broadcasts(type, title, message, sender_name, sender_avatar, receiver_name, receiver_avatar, icon_url)
    values (
      'new_cp', 'A New JALWA Couple!',
      format('%s and %s are now CP partners!', coalesce(v_sender_name, 'Partner'), coalesce(v_receiver_name, 'Partner')) || ' ❤️',
      v_sender_name, v_sender_avatar, v_receiver_name, v_receiver_avatar, v_ring.icon_url
    );
  end if;

  return jsonb_build_object('success', true, 'status', 'accepted', 'relation_id', v_relation, 'ring_name', v_ring.name);
end;
$$;
revoke all on function public.cp_respond_proposal_v2(uuid, boolean) from public, anon;
grant execute on function public.cp_respond_proposal_v2(uuid, boolean) to authenticated;

alter table public.cp_breakup_requests
  drop constraint if exists cp_breakup_requests_status_check;
alter table public.cp_breakup_requests
  add constraint cp_breakup_requests_status_check
  check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'expired'));

create or replace function public.cp_cancel_breakup_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;

  update public.cp_breakup_requests
  set status = 'cancelled', responded_at = now()
  where id = p_request_id
    and requester_id = v_actor
    and status = 'pending'
    and created_at >= now() - interval '24 hours'
  returning id into v_id;

  if not found then
    if exists (
      select 1 from public.cp_breakup_requests
      where id = p_request_id and requester_id = v_actor and status = 'pending'
        and created_at < now() - interval '24 hours'
    ) then raise exception 'BREAKUP_CANCEL_WINDOW_EXPIRED'; end if;
    raise exception 'BREAKUP_REQUEST_NOT_CANCELLABLE';
  end if;

  return jsonb_build_object('success', true, 'status', 'cancelled', 'request_id', v_id);
end;
$$;
revoke all on function public.cp_cancel_breakup_request(uuid) from public, anon;
grant execute on function public.cp_cancel_breakup_request(uuid) to authenticated;

create or replace function public.cp_expire_stale_workflows()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_proposal public.cp_proposals%rowtype;
  v_breakup public.cp_breakup_requests%rowtype;
  v_proposals_expired integer := 0;
  v_breakups_expired integer := 0;
  v_refunded bigint := 0;
  v_refund bigint;
begin
  for v_proposal in
    select * from public.cp_proposals
    where status = 'pending' and created_at <= now() - interval '7 days'
    order by created_at
    for update skip locked
  loop
    update public.cp_proposals set status = 'expired', responded_at = now() where id = v_proposal.id;
    v_refund := public.cp_refund_proposal_fee(v_proposal.id, 'expired');
    v_refunded := v_refunded + coalesce(v_refund, 0);
    v_proposals_expired := v_proposals_expired + 1;
  end loop;

  for v_breakup in
    select * from public.cp_breakup_requests
    where status = 'pending' and created_at <= now() - interval '7 days'
    order by created_at
    for update skip locked
  loop
    update public.cp_relations
      set status = 'divorced', ended_at = now()
      where id = v_breakup.relation_id and status = 'active';
    update public.cp_breakup_requests
      set status = 'expired', responded_at = now()
      where id = v_breakup.id and status = 'pending';
    v_breakups_expired := v_breakups_expired + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'expired_proposals', v_proposals_expired,
    'expired_breakup_requests', v_breakups_expired,
    'refunded_coins', v_refunded
  );
end;
$$;
revoke all on function public.cp_expire_stale_workflows() from public, anon, authenticated;
grant execute on function public.cp_expire_stale_workflows() to postgres, service_role;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'cp-expire-stale-workflows';

    perform cron.schedule(
      'cp-expire-stale-workflows',
      '*/15 * * * *',
      'select public.cp_expire_stale_workflows();'
    );
  end if;
end $$;

commit;
