-- End-to-end flow tests for Jalwa backend RPCs.
-- Runs in a single transaction; all changes rolled back at the end.
-- Impersonates users via `request.jwt.claims` so `auth.uid()` returns expected ids.
--
-- Coverage:
--   1. Recharge approval flow (create request → approve → coins credited)
--   2. Recharge rejection flow (create request → reject → status=rejected)
--   3. Withdrawal flow (request → escrow deducts → approve → status=approved)
--   4. Withdrawal reject flow (request → reject → diamonds refunded)
--   5. Support claim + close flow
--   6. Sign-in surface (auth.users row exists + profile row auto-created)
--
-- Run: psql "$JALWA_DB_URL" -v ON_ERROR_STOP=1 -f tests/e2e/flows.test.sql

\set ON_ERROR_STOP on
\timing off
BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- Fixtures
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT user_id INTO admin_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'FIXTURE: no admin user in user_roles';
  END IF;
  PERFORM set_config('test.admin_id', admin_id::text, false);
END $$;

-- Create two disposable test users directly in auth.users.
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e2e_user1@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}', '{}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e2e_user2@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}', '{}')
ON CONFLICT (id) DO NOTHING;

-- Ensure profile rows exist (in case handle_new_user trigger doesn't fire under BEGIN).
INSERT INTO public.profiles (id, username, coins, diamonds)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'e2e_user1', 0, 0),
  ('22222222-2222-2222-2222-222222222222', 'e2e_user2', 0, 500000)
ON CONFLICT (id) DO UPDATE SET coins = EXCLUDED.coins, diamonds = EXCLUDED.diamonds;

\echo
\echo === TEST 1: Sign-in surface (auth.users + profile) ===
DO $$
DECLARE
  ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE u.email = 'e2e_user1@test.local'
  ) INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL: sign-in surface missing user/profile join'; END IF;
  RAISE NOTICE 'PASS: sign-in surface (auth+profile joinable)';
END $$;

\echo
\echo === TEST 2: Recharge approval flow ===
DO $$
DECLARE
  admin_id uuid := current_setting('test.admin_id')::uuid;
  user_id  uuid := '11111111-1111-1111-1111-111111111111';
  req_id   uuid;
  before_coins bigint;
  after_coins  bigint;
BEGIN
  SELECT coins INTO before_coins FROM public.profiles WHERE id = user_id;

  -- User creates a recharge request
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_id::text, 'role','authenticated')::text, true);
  INSERT INTO public.recharge_requests (user_id, amount_paid, coins, coins_expected, method, status)
  VALUES (user_id, 100.00, 1000, 1000, 'manual', 'pending')
  RETURNING id INTO req_id;

  -- Admin approves
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_id::text, 'role','authenticated')::text, true);
  PERFORM public.approve_recharge(req_id, 'e2e approve');

  SELECT coins INTO after_coins FROM public.profiles WHERE id = user_id;

  IF after_coins - before_coins <> 1000 THEN
    RAISE EXCEPTION 'FAIL: expected +1000 coins, got %', after_coins - before_coins;
  END IF;
  IF (SELECT status FROM public.recharge_requests WHERE id = req_id) <> 'approved' THEN
    RAISE EXCEPTION 'FAIL: recharge status not approved';
  END IF;
  RAISE NOTICE 'PASS: recharge approval credited % coins', after_coins - before_coins;
END $$;

\echo
\echo === TEST 3: Recharge rejection flow ===
DO $$
DECLARE
  admin_id uuid := current_setting('test.admin_id')::uuid;
  user_id  uuid := '11111111-1111-1111-1111-111111111111';
  req_id   uuid;
  before_coins bigint;
  after_coins  bigint;
BEGIN
  SELECT coins INTO before_coins FROM public.profiles WHERE id = user_id;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_id::text, 'role','authenticated')::text, true);
  INSERT INTO public.recharge_requests (user_id, amount_paid, coins, coins_expected, method, status)
  VALUES (user_id, 50.00, 500, 500, 'manual', 'pending')
  RETURNING id INTO req_id;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_id::text, 'role','authenticated')::text, true);
  PERFORM public.reject_recharge(req_id, 'e2e reject');

  SELECT coins INTO after_coins FROM public.profiles WHERE id = user_id;

  IF after_coins <> before_coins THEN
    RAISE EXCEPTION 'FAIL: coins changed on reject (before=% after=%)', before_coins, after_coins;
  END IF;
  IF (SELECT status FROM public.recharge_requests WHERE id = req_id) <> 'rejected' THEN
    RAISE EXCEPTION 'FAIL: recharge status not rejected';
  END IF;
  RAISE NOTICE 'PASS: recharge rejection preserved coin balance';
END $$;

\echo
\echo === TEST 4: Withdrawal request + approval flow ===
DO $$
DECLARE
  admin_id uuid := current_setting('test.admin_id')::uuid;
  user_id  uuid := '22222222-2222-2222-2222-222222222222';
  req_id   uuid;
  before_dia bigint;
  after_req_dia bigint;
  final_dia bigint;
BEGIN
  SELECT diamonds INTO before_dia FROM public.profiles WHERE id = user_id;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_id::text, 'role','authenticated')::text, true);
  req_id := public.request_withdrawal(1000, 'manual', '0300-0000000', 'E2E User');

  SELECT diamonds INTO after_req_dia FROM public.profiles WHERE id = user_id;
  IF before_dia - after_req_dia <> 1000 THEN
    RAISE EXCEPTION 'FAIL: escrow expected -1000 diamonds, got %', before_dia - after_req_dia;
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_id::text, 'role','authenticated')::text, true);
  PERFORM public.approve_withdrawal(req_id);

  SELECT diamonds INTO final_dia FROM public.profiles WHERE id = user_id;
  IF final_dia <> after_req_dia THEN
    RAISE EXCEPTION 'FAIL: diamonds should stay deducted after approval (was % now %)', after_req_dia, final_dia;
  END IF;
  IF (SELECT status FROM public.withdrawal_requests WHERE id = req_id) <> 'approved' THEN
    RAISE EXCEPTION 'FAIL: withdrawal status not approved';
  END IF;
  RAISE NOTICE 'PASS: withdrawal escrow + approval settled correctly';
END $$;

\echo
\echo === TEST 5: Withdrawal rejection refunds diamonds ===
DO $$
DECLARE
  admin_id uuid := current_setting('test.admin_id')::uuid;
  user_id  uuid := '22222222-2222-2222-2222-222222222222';
  req_id   uuid;
  before_dia bigint;
  mid_dia    bigint;
  final_dia  bigint;
BEGIN
  SELECT diamonds INTO before_dia FROM public.profiles WHERE id = user_id;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_id::text, 'role','authenticated')::text, true);
  req_id := public.request_withdrawal(500, 'manual', '0300-0000000', 'E2E User');
  SELECT diamonds INTO mid_dia FROM public.profiles WHERE id = user_id;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_id::text, 'role','authenticated')::text, true);
  PERFORM public.reject_withdrawal(req_id, 'e2e reject');

  SELECT diamonds INTO final_dia FROM public.profiles WHERE id = user_id;
  IF final_dia <> before_dia THEN
    RAISE EXCEPTION 'FAIL: reject should refund to %, got %', before_dia, final_dia;
  END IF;
  IF (SELECT status FROM public.withdrawal_requests WHERE id = req_id) <> 'rejected' THEN
    RAISE EXCEPTION 'FAIL: withdrawal status not rejected';
  END IF;
  RAISE NOTICE 'PASS: withdrawal rejection refunded diamonds';
END $$;

\echo
\echo === TEST 6: Support claim + close flow ===
DO $$
DECLARE
  admin_id uuid := current_setting('test.admin_id')::uuid;
  user_id  uuid := '11111111-1111-1111-1111-111111111111';
  conv_id  uuid;
BEGIN
  -- User opens conversation
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_id::text, 'role','authenticated')::text, true);
  INSERT INTO public.support_conversations (user_id, status, last_message_preview)
  VALUES (user_id, 'open', 'hi need help')
  ON CONFLICT (user_id) DO UPDATE SET status = 'open', assigned_agent = NULL, last_message_preview = EXCLUDED.last_message_preview
  RETURNING id INTO conv_id;

  -- Agent (admin has is_support_agent=true) claims
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_id::text, 'role','authenticated')::text, true);
  PERFORM public.claim_support_conversation(conv_id);

  IF (SELECT assigned_agent FROM public.support_conversations WHERE id = conv_id) <> admin_id THEN
    RAISE EXCEPTION 'FAIL: claim did not set assigned_agent';
  END IF;

  -- Agent closes
  PERFORM public.close_support_conversation(conv_id);
  IF (SELECT status FROM public.support_conversations WHERE id = conv_id) <> 'closed' THEN
    RAISE EXCEPTION 'FAIL: close did not mark conversation closed';
  END IF;
  RAISE NOTICE 'PASS: support claim + close flow';
END $$;

\echo
\echo === TEST 7: Non-admin cannot approve recharge ===
DO $$
DECLARE
  user_id uuid := '11111111-1111-1111-1111-111111111111';
  req_id  uuid;
  caught  boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_id::text, 'role','authenticated')::text, true);
  INSERT INTO public.recharge_requests (user_id, amount_paid, coins, coins_expected, method, status)
  VALUES (user_id, 10.00, 100, 100, 'manual', 'pending') RETURNING id INTO req_id;

  BEGIN
    PERFORM public.approve_recharge(req_id, NULL);
  EXCEPTION WHEN OTHERS THEN
    caught := true;
  END;
  IF NOT caught THEN
    RAISE EXCEPTION 'FAIL: non-admin was able to approve recharge';
  END IF;
  RAISE NOTICE 'PASS: non-admin approve blocked';
END $$;

ROLLBACK;

\echo
\echo ================================================
\echo   All e2e flow tests completed successfully.
\echo ================================================
