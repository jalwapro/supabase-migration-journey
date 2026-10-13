-- CP qualification alternative: 13,333 coins of verified romantic gifts before pairing.
-- Proposal remains mutual/accepted; the qualifying romantic gifts waive the proposal charge.
-- No LiveKit tables, tokens, rooms, or APIs are changed.

begin;

create table if not exists public.cp_prelink_intimacy_events (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  gift_send_id uuid not null unique references public.gift_sends(id) on delete cascade,
  intimacy bigint not null check (intimacy > 0),
  created_at timestamptz not null default now(),
  constraint cp_prelink_not_self check (sender_id <> receiver_id)
);

create index if not exists cp_prelink_intimacy_pair_idx
  on public.cp_prelink_intimacy_events(sender_id, receiver_id, created_at);

alter table public.cp_prelink_intimacy_events enable row level security;
revoke all on public.cp_prelink_intimacy_events from anon, authenticated;

create or replace function public.cp_track_prelink_romantic_gift()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_category text;
  v_user1 uuid;
  v_user2 uuid;
begin
  if new.coins_spent is null or new.coins_spent <= 0 or new.sender_id = new.receiver_id then
    return new;
  end if;

  select lower(coalesce(g.category,'')) into v_category
    from public.gifts g where g.id = new.gift_id;
  if coalesce(v_category,'') not like '%romantic%' then
    return new;
  end if;

  v_user1 := least(new.sender_id,new.receiver_id);
  v_user2 := greatest(new.sender_id,new.receiver_id);
  if exists (
    select 1 from public.cp_relations r
     where r.status='active'
       and r.user1_id=v_user1 and r.user2_id=v_user2
  ) then
    return new;
  end if;

  insert into public.cp_prelink_intimacy_events(sender_id,receiver_id,gift_send_id,intimacy)
  values(new.sender_id,new.receiver_id,new.id,new.coins_spent)
  on conflict(gift_send_id) do nothing;
  return new;
end
$$;

drop trigger if exists cp_prelink_romantic_gift_after_insert on public.gift_sends;
create trigger cp_prelink_romantic_gift_after_insert
  after insert on public.gift_sends
  for each row execute function public.cp_track_prelink_romantic_gift();

-- The server calculates the fee. A client cannot claim qualification or set a zero price.
create or replace function public.cp_send_proposal(p_receiver_id uuid, p_ring_price bigint default 13333)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_sender uuid := auth.uid();
  v_sender_coins bigint;
  v_status text;
  v_prelink_spend bigint;
  v_actual_price bigint;
begin
  if v_sender is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_receiver_id is null or p_receiver_id = v_sender then raise exception 'INVALID_RECEIVER'; end if;

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

  select coalesce(sum(e.intimacy),0)::bigint into v_prelink_spend
    from public.cp_prelink_intimacy_events e
   where (e.sender_id=v_sender and e.receiver_id=p_receiver_id)
      or (e.sender_id=p_receiver_id and e.receiver_id=v_sender);

  v_actual_price := case when v_prelink_spend >= 13333 then 0 else 13333 end;

  update public.profiles set coins=coins-v_actual_price, updated_at=now()
    where id=v_sender and coins>=v_actual_price
    returning coins into v_sender_coins;
  if not found then raise exception 'INSUFFICIENT_COINS'; end if;

  if v_actual_price > 0 then
    perform set_config('app.trusted_definer','on',true);
    insert into public.wallet_transactions(user_id,kind,coins,coins_delta,balance_coins_after,ref_type,note)
      values(v_sender,'cp_proposal',v_actual_price,-v_actual_price,v_sender_coins,'cp','CP proposal gift');
    perform set_config('app.trusted_definer','off',true);
  end if;

  insert into public.cp_proposals(sender_id,receiver_id,ring_price)
    values(v_sender,p_receiver_id,v_actual_price) returning status into v_status;
  return jsonb_build_object(
    'ok',true,
    'coins_remaining',v_sender_coins,
    'status',v_status,
    'ring_price',v_actual_price,
    'prelink_romantic_gift_coins',v_prelink_spend,
    'proposal_fee_waived',v_actual_price=0
  );
end
$$;

revoke all on function public.cp_track_prelink_romantic_gift() from public, anon, authenticated;
revoke all on function public.cp_send_proposal(uuid,bigint) from public, anon;
grant execute on function public.cp_send_proposal(uuid,bigint) to authenticated;

commit;
