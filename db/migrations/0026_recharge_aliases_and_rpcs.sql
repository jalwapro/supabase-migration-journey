-- ============================================================================
-- Fix manual recharge (admin approve/reject + user submit)
--
-- Problem: client code uses new column names (amount_pkr, coins_expected,
-- proof_url, sender_name, sender_account, txn_reference, note) that the
-- table does not have, and calls approve_recharge/reject_recharge with an
-- `_admin_note` parameter the RPCs do not accept.
--
-- Fix:
--   1. Add the new columns on recharge_requests as aliases of existing ones,
--      with a BEFORE INSERT/UPDATE trigger keeping both sides in sync so old
--      code (RPCs, reports) and new code (client forms) both keep working.
--   2. Backfill new columns from existing rows.
--   3. Recreate approve_recharge / reject_recharge so they accept _admin_note
--      and both write it into the admin_note column.
-- ============================================================================

-- ---------- 1. Alias columns ------------------------------------------------
alter table public.recharge_requests
  add column if not exists amount_pkr numeric(10,2),
  add column if not exists coins_expected bigint,
  add column if not exists proof_url text,
  add column if not exists sender_name text,
  add column if not exists sender_account text,
  add column if not exists txn_reference text,
  add column if not exists note text;

-- Backfill from existing columns
update public.recharge_requests
   set amount_pkr = coalesce(amount_pkr, amount_paid),
       coins_expected = coalesce(coins_expected, coins),
       proof_url = coalesce(proof_url, proof_image),
       sender_account = coalesce(sender_account, sender_number),
       txn_reference = coalesce(txn_reference, txn_id);

-- ---------- 2. Bidirectional sync trigger -----------------------------------
create or replace function public.recharge_requests_sync_aliases()
returns trigger
language plpgsql
as $$
begin
  -- amount
  if new.amount_pkr is null and new.amount_paid is not null then
    new.amount_pkr := new.amount_paid;
  elsif new.amount_paid is null and new.amount_pkr is not null then
    new.amount_paid := new.amount_pkr;
  end if;

  -- coins
  if new.coins_expected is null and new.coins is not null then
    new.coins_expected := new.coins;
  elsif new.coins is null and new.coins_expected is not null then
    new.coins := new.coins_expected;
  end if;

  -- proof url ↔ image
  if new.proof_url is null and new.proof_image is not null then
    new.proof_url := new.proof_image;
  elsif new.proof_image is null and new.proof_url is not null then
    new.proof_image := new.proof_url;
  end if;

  -- sender account ↔ number
  if new.sender_account is null and new.sender_number is not null then
    new.sender_account := new.sender_number;
  elsif new.sender_number is null and new.sender_account is not null then
    new.sender_number := new.sender_account;
  end if;

  -- txn reference ↔ id
  if new.txn_reference is null and new.txn_id is not null then
    new.txn_reference := new.txn_id;
  elsif new.txn_id is null and new.txn_reference is not null then
    new.txn_id := new.txn_reference;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_recharge_requests_sync on public.recharge_requests;
create trigger trg_recharge_requests_sync
  before insert or update on public.recharge_requests
  for each row execute function public.recharge_requests_sync_aliases();

-- ---------- 3. RPCs with _admin_note ----------------------------------------
create or replace function public.approve_recharge(
  _request_id uuid,
  _admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _req public.recharge_requests%rowtype;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only admins can approve recharges';
  end if;

  select * into _req from public.recharge_requests where id = _request_id for update;
  if not found then
    raise exception 'Recharge request not found';
  end if;
  if _req.status <> 'pending' then
    raise exception 'Recharge request already processed';
  end if;

  update public.recharge_requests
    set status = 'approved',
        processed_at = now(),
        admin_note = coalesce(_admin_note, admin_note)
    where id = _request_id;

  update public.profiles
    set coins = coins + _req.coins,
        updated_at = now()
    where id = _req.user_id;

  insert into public.wallet_transactions (user_id, kind, coins, note)
    values (_req.user_id, 'recharge', _req.coins, coalesce(_admin_note, 'Recharge approved'));
end;
$$;

-- Drop old reject_recharge signature (uses `_note`) then recreate with `_admin_note`
drop function if exists public.reject_recharge(uuid, text);

create or replace function public.reject_recharge(
  _request_id uuid,
  _admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only admins can reject recharges';
  end if;

  update public.recharge_requests
    set status = 'rejected',
        processed_at = now(),
        admin_note = _admin_note
    where id = _request_id and status = 'pending';

  if not found then
    raise exception 'Recharge request not found or already processed';
  end if;
end;
$$;

grant execute on function public.approve_recharge(uuid, text) to authenticated;
grant execute on function public.reject_recharge(uuid, text) to authenticated;

notify pgrst, 'reload schema';
