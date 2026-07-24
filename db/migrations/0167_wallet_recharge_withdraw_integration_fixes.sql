-- ============================================================================
-- 0167_wallet_recharge_withdraw_integration_fixes.sql
--
-- Full-sweep audit fixes for the wallet + recharge + withdrawal flow.
-- Companion frontend changes: admin.recharge.tsx, admin.coins.tsx,
-- admin.payment-accounts.tsx, withdraw.tsx, recharge-history.tsx.
--
-- Fixes (matches audit numbering):
--   #2  approve_recharge missed the `app.trusted_definer` guard set by
--       migration 0156 -> coin credit silently reverted. Patch it (and
--       reject_recharge for consistency, even though it does not touch
--       balance today).
--   #5  approve_recharge / reject_recharge / approve_withdrawal /
--       reject_withdrawal never notified the affected user. Insert a
--       row into public.notifications so the user gets a toast + push
--       via the existing notif channel.
--   #6  approve_recharge did not audit -- withdrawal already did. Move
--       audit into the RPCs themselves so no UI path can skip it.
--   #7  RLS UPDATE policy on public.recharge_requests allowed admins to
--       flip status='approved' directly from the client, bypassing the
--       coin-credit RPC. Restrict admin UPDATE to admin_note only; force
--       status changes through approve_recharge / reject_recharge (which
--       run SECURITY DEFINER and bypass RLS).
--   #8  Legacy overly-broad grant on public.withdrawal_requests
--       (INSERT/UPDATE/DELETE to authenticated) never revoked. Lock down
--       to SELECT only; writes go through RPCs.
--   #9  Recharge RPCs did not REVOKE from public/anon like the withdraw
--       RPCs do. Add matching hardening.
--   #15 request_withdrawal had no max cap. Enforce a per-request max
--       from app_settings.max_withdrawal_diamonds (defaults to 10,000,000).
-- ============================================================================

-- ---------------------------------------------------------------- #15 setup: max withdrawal cap
alter table public.app_settings
  add column if not exists max_withdrawal_diamonds bigint not null default 10000000;

update public.app_settings
   set max_withdrawal_diamonds = coalesce(max_withdrawal_diamonds, 10000000)
 where id = 'global';

-- ---------------------------------------------------------------- #2 + #5 + #6: fix approve_recharge
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
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;

  select * into _req from public.recharge_requests where id = _request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if _req.status <> 'pending' then raise exception 'Already %', _req.status; end if;

  -- Mark the request approved first.
  update public.recharge_requests
     set status = 'approved',
         admin_note = coalesce(_admin_note, admin_note),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = _request_id;

  -- Credit coins under the trusted-definer marker so the 0156 profile
  -- guard trigger allows the write.
  perform set_config('app.trusted_definer', 'on', true);
  update public.profiles
     set coins = coins + _req.coins_expected
   where id = _req.user_id;
  perform set_config('app.trusted_definer', 'off', true);

  -- Wallet ledger row.
  insert into public.wallet_transactions (
    user_id, kind, coins_delta, ref_type, ref_id, note
  ) values (
    _req.user_id, 'recharge', _req.coins_expected, 'recharge_request', _req.id,
    'Recharge approved by admin'
  );

  -- Notify the user.
  insert into public.notifications (user_id, kind, title, body, ref_type, ref_id)
  values (
    _req.user_id,
    'recharge_approved',
    'Recharge approved 🎉',
    'Rs ' || _req.amount_pkr::text || ' recharge approved. ' ||
      _req.coins_expected::text || ' coins credited.',
    'recharge_request',
    _req.id
  );

  -- Admin audit trail.
  insert into public.admin_logs (action, target, details)
  values (
    'recharge_approved',
    _req.id::text,
    jsonb_build_object(
      'user_id', _req.user_id,
      'coins', _req.coins_expected,
      'amount_pkr', _req.amount_pkr,
      'method', _req.method,
      'admin_note', _admin_note
    )
  );
end;
$$;

-- ---------------------------------------------------------------- #5 + #6: fix reject_recharge
create or replace function public.reject_recharge(
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
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;

  select * into _req from public.recharge_requests where id = _request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if _req.status <> 'pending' then raise exception 'Already %', _req.status; end if;

  update public.recharge_requests
     set status = 'rejected',
         admin_note = coalesce(_admin_note, admin_note),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = _request_id;

  insert into public.notifications (user_id, kind, title, body, ref_type, ref_id)
  values (
    _req.user_id,
    'recharge_rejected',
    'Recharge rejected',
    coalesce(_admin_note, 'Your recharge request was rejected. Please contact support.'),
    'recharge_request',
    _req.id
  );

  insert into public.admin_logs (action, target, details)
  values (
    'recharge_rejected',
    _req.id::text,
    jsonb_build_object(
      'user_id', _req.user_id,
      'coins', _req.coins_expected,
      'amount_pkr', _req.amount_pkr,
      'admin_note', _admin_note
    )
  );
end;
$$;

-- ---------------------------------------------------------------- #9: harden recharge RPC grants
revoke all on function public.approve_recharge(uuid, text) from public, anon;
revoke all on function public.reject_recharge(uuid, text)  from public, anon;
grant execute on function public.approve_recharge(uuid, text) to authenticated;
grant execute on function public.reject_recharge(uuid, text)  to authenticated;

-- ---------------------------------------------------------------- #5: notify user on withdrawal approve/reject
-- We wrap the existing RPCs with post-triggers via a status-change trigger
-- so we do not have to redefine the whole function bodies here.
create or replace function public._notify_withdrawal_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('approved', 'rejected') then
    insert into public.notifications (user_id, kind, title, body, ref_type, ref_id)
    values (
      new.user_id,
      case when new.status = 'approved' then 'withdrawal_approved' else 'withdrawal_rejected' end,
      case when new.status = 'approved'
             then 'Withdrawal approved 💸'
             else 'Withdrawal rejected'
      end,
      case when new.status = 'approved'
             then 'PKR ' || new.amount_pkr::text || ' payout approved to ' ||
                  coalesce(new.method, 'your account') || '.'
             else coalesce(new.admin_note,
                    'Your withdrawal was rejected. Diamonds have been refunded.')
      end,
      'withdrawal_request',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_withdrawal_status_notify on public.withdrawal_requests;
create trigger trg_withdrawal_status_notify
  after update of status on public.withdrawal_requests
  for each row execute function public._notify_withdrawal_status_change();

-- ---------------------------------------------------------------- #7: lock down recharge_requests admin UPDATE
drop policy if exists "admins update recharges" on public.recharge_requests;

-- Admins may still see everything for the queue.
drop policy if exists "admins read all recharges" on public.recharge_requests;
create policy "admins read all recharges"
  on public.recharge_requests for select
  to authenticated
  using (public.is_admin());

-- Only status changes via the SECURITY DEFINER RPCs (which bypass RLS).
-- The narrow admin UPDATE below lets admins edit admin_note only (client
-- WITH CHECK still blocks any status flip, since NEW.status must equal
-- OLD.status).
create policy "admins edit recharge notes"
  on public.recharge_requests for update
  to authenticated
  using (public.is_admin())
  with check (
    public.is_admin()
    and status = (select r.status from public.recharge_requests r where r.id = recharge_requests.id)
  );

-- ---------------------------------------------------------------- #8: lock down withdrawal_requests table grants
revoke insert, update, delete on public.withdrawal_requests from authenticated;
grant select on public.withdrawal_requests to authenticated;
grant all on public.withdrawal_requests to service_role;

-- ---------------------------------------------------------------- #15: enforce max withdrawal cap
create or replace function public.request_withdrawal(
  _diamonds bigint,
  _method public.pay_method,
  _account_number text,
  _account_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _bal bigint;
  _rate numeric;
  _max bigint;
  _req_id uuid;
  _amount_pkr numeric;
begin
  if _uid is null then raise exception 'Not signed in'; end if;
  if _diamonds < 100 then raise exception 'Minimum 100 points'; end if;

  select coalesce(max_withdrawal_diamonds, 10000000)
    into _max from public.app_settings where id = 'global';
  if _diamonds > _max then
    raise exception 'Max % points per withdrawal', _max;
  end if;

  select diamonds into _bal from public.profiles where id = _uid for update;
  if _bal is null or _bal < _diamonds then
    raise exception 'Not enough points';
  end if;

  if exists (
    select 1 from public.withdrawal_requests
     where user_id = _uid and status = 'pending'
  ) then
    raise exception 'You already have a pending withdrawal';
  end if;

  select coalesce(diamond_price_pkr, 0.5)
    into _rate from public.app_settings where id = 'global';
  _amount_pkr := _diamonds * _rate;

  -- Escrow the diamonds (deduct now; refunded on reject).
  perform set_config('app.trusted_definer', 'on', true);
  update public.profiles set diamonds = diamonds - _diamonds where id = _uid;
  perform set_config('app.trusted_definer', 'off', true);

  insert into public.withdrawal_requests (
    user_id, diamonds, amount_pkr, method, account_number, account_name, status
  ) values (
    _uid, _diamonds, _amount_pkr, _method, _account_number, _account_name, 'pending'
  ) returning id into _req_id;

  insert into public.wallet_transactions (user_id, kind, diamonds_delta, ref_type, ref_id, note)
  values (_uid, 'withdrawal_hold', -_diamonds, 'withdrawal_request', _req_id, 'Withdrawal requested');

  return _req_id;
end;
$$;

revoke all on function public.request_withdrawal(bigint, public.pay_method, text, text) from public, anon;
grant execute on function public.request_withdrawal(bigint, public.pay_method, text, text) to authenticated;

-- ---------------------------------------------------------------- Public read of the withdrawal rate for UI display
-- The withdraw page shows an "≈ Rs. X" estimate. Expose the current rate
-- via a narrow RPC so the UI can never drift from the server payout.
create or replace function public.get_withdrawal_settings()
returns table(diamond_price_pkr numeric, max_withdrawal_diamonds bigint, min_withdrawal_diamonds bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(diamond_price_pkr, 0.5)::numeric,
    coalesce(max_withdrawal_diamonds, 10000000)::bigint,
    100::bigint
  from public.app_settings where id = 'global'
  union all
  select 0.5::numeric, 10000000::bigint, 100::bigint
   where not exists (select 1 from public.app_settings where id = 'global')
  limit 1;
$$;

grant execute on function public.get_withdrawal_settings() to anon, authenticated;

notify pgrst, 'reload schema';
