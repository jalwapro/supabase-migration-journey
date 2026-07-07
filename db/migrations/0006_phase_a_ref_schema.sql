-- Phase A: Full schema port from jalwa1-main reference project
-- Consolidated from 30 upstream migrations (2411 lines)


-- ============ 20260704235032_aca40426-796a-48a8-ac2f-7225ffa0ef4e.sql ============

-- ========== ENUMS ==========
CREATE TYPE public.app_role AS ENUM ('user','host','agent','moderator','admin','super_admin');
CREATE TYPE public.recharge_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.pay_method AS ENUM ('jazzcash','easypaisa','bank_transfer','crypto','manual');

-- ========== PROFILES ==========
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar TEXT,
  frame TEXT,
  bio TEXT,
  gender TEXT DEFAULT 'other',
  country TEXT,
  coins BIGINT NOT NULL DEFAULT 0,
  diamonds BIGINT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  is_vip BOOLEAN NOT NULL DEFAULT false,
  vip_expiry TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ========== USER ROLES ==========
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin'))
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ========== NEW USER TRIGGER ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== updated_at helper ==========
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== COIN PACKAGES ==========
CREATE TABLE public.coin_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coins BIGINT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  bonus_coins BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coin_packages TO anon, authenticated;
GRANT ALL ON public.coin_packages TO service_role;
ALTER TABLE public.coin_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views active packages" ON public.coin_packages FOR SELECT USING (is_active OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage packages" ON public.coin_packages FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ========== RECHARGE REQUESTS ==========
CREATE TABLE public.recharge_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.coin_packages(id) ON DELETE SET NULL,
  amount_paid NUMERIC(10,2) NOT NULL,
  coins BIGINT NOT NULL,
  method public.pay_method NOT NULL DEFAULT 'manual',
  sender_number TEXT,
  txn_id TEXT,
  proof_image TEXT,
  status public.recharge_status NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT ON public.recharge_requests TO authenticated;
GRANT ALL ON public.recharge_requests TO service_role;
ALTER TABLE public.recharge_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own recharges" ON public.recharge_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own recharges" ON public.recharge_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view recharges" ON public.recharge_requests FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage recharges" ON public.recharge_requests FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ========== WALLET TRANSACTIONS ==========
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  coins BIGINT NOT NULL DEFAULT 0,
  diamonds BIGINT NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own wallet txns" ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view wallet txns" ON public.wallet_transactions FOR SELECT USING (public.is_admin(auth.uid()));

-- ========== BANNERS ==========
CREATE TABLE public.banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image TEXT NOT NULL,
  title TEXT,
  subtitle TEXT,
  cta_text TEXT,
  link TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.banners TO anon, authenticated;
GRANT ALL ON public.banners TO service_role;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views active banners" ON public.banners FOR SELECT USING (is_active OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage banners" ON public.banners FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ 20260704235121_3d8e4cda-40ff-4e14-a572-8a7c39e4b7ca.sql ============

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
-- has_role/is_admin must stay executable for RLS policy evaluation; restrict to signed-in + admin surface only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;

-- ============ 20260704235150_61b6bc1b-b4cf-4d1a-9482-1039655a086e.sql ============

-- Simplify anon-facing policies so they don't call is_admin (removes anon execute path)
DROP POLICY "Anyone views active banners" ON public.banners;
CREATE POLICY "Public views active banners" ON public.banners FOR SELECT TO anon USING (is_active);
CREATE POLICY "Authed views banners" ON public.banners FOR SELECT TO authenticated USING (is_active OR public.is_admin(auth.uid()));

DROP POLICY "Anyone views active packages" ON public.coin_packages;
CREATE POLICY "Public views active packages" ON public.coin_packages FOR SELECT TO anon USING (is_active);
CREATE POLICY "Authed views packages" ON public.coin_packages FOR SELECT TO authenticated USING (is_active OR public.is_admin(auth.uid()));

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;

-- ============ 20260704235214_edf3fde7-05c5-41a8-995d-ad03dbfc10e6.sql ============

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

-- ============ 20260705001050_eee2f8ec-ee81-4478-9ee3-c53aaf80c0ef.sql ============
-- Payment accounts (admin-configured EasyPaisa/JazzCash/Bank numbers shown on wallet)
CREATE TABLE public.payment_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  method public.pay_method NOT NULL DEFAULT 'easypaisa',
  label text NOT NULL,
  account_number text NOT NULL,
  account_holder text NOT NULL,
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_accounts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_accounts TO authenticated;
GRANT ALL ON public.payment_accounts TO service_role;

ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active payment accounts"
  ON public.payment_accounts FOR SELECT
  USING (is_active = true OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage payment accounts"
  ON public.payment_accounts FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_payment_accounts_updated_at
  BEFORE UPDATE ON public.payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomic recharge approval: verify caller is admin, add coins, log transaction, mark approved
CREATE OR REPLACE FUNCTION public.approve_recharge(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.recharge_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can approve recharges';
  END IF;

  SELECT * INTO _req FROM public.recharge_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recharge request not found';
  END IF;
  IF _req.status <> 'pending' THEN
    RAISE EXCEPTION 'Recharge request already processed';
  END IF;

  UPDATE public.recharge_requests
    SET status = 'approved', processed_at = now()
    WHERE id = _request_id;

  UPDATE public.profiles
    SET coins = coins + _req.coins, updated_at = now()
    WHERE id = _req.user_id;

  INSERT INTO public.wallet_transactions (user_id, kind, coins, note)
    VALUES (_req.user_id, 'recharge', _req.coins, 'Recharge approved');
END;
$$;

REVOKE ALL ON FUNCTION public.approve_recharge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_recharge(uuid) TO authenticated;

-- Reject a pending recharge with an optional note
CREATE OR REPLACE FUNCTION public.reject_recharge(_request_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can reject recharges';
  END IF;

  UPDATE public.recharge_requests
    SET status = 'rejected', processed_at = now(), admin_note = _note
    WHERE id = _request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recharge request not found or already processed';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_recharge(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_recharge(uuid, text) TO authenticated;

-- Seed default payment accounts (placeholders — admin edits later)
INSERT INTO public.payment_accounts (method, label, account_number, account_holder, instructions, sort_order)
VALUES
  ('easypaisa', 'EasyPaisa', '0300-0000000', 'Jalwa Official', 'Send exact amount then submit sender number & TID.', 1),
  ('jazzcash', 'JazzCash', '0301-0000000', 'Jalwa Official', 'Send exact amount then submit sender number & TID.', 2);
-- ============ 20260705043338_1073b59c-e79d-418a-bcc7-89ced9becb89.sql ============

-- ============ GIFTS CATALOG ============
CREATE TABLE public.gifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'popular',
  animation TEXT NOT NULL DEFAULT 'pop',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gifts TO anon, authenticated;
GRANT ALL ON public.gifts TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.gifts TO authenticated;
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active gifts" ON public.gifts FOR SELECT USING (is_active OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage gifts" ON public.gifts FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ ROOMS ============
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  room_type TEXT NOT NULL DEFAULT 'voice',
  category TEXT NOT NULL DEFAULT 'popular',
  cover TEXT,
  country TEXT DEFAULT '🌍',
  is_live BOOLEAN NOT NULL DEFAULT true,
  viewers INTEGER NOT NULL DEFAULT 0,
  seat_count INTEGER NOT NULL DEFAULT 8,
  total_points BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view live rooms" ON public.rooms FOR SELECT USING (is_live OR host_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Users can create their own room" ON public.rooms FOR INSERT TO authenticated WITH CHECK (host_id = auth.uid());
CREATE POLICY "Host or admin can update room" ON public.rooms FOR UPDATE TO authenticated USING (host_id = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK (host_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Host or admin can delete room" ON public.rooms FOR DELETE TO authenticated USING (host_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ROOM MESSAGES ============
CREATE TABLE public.room_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  username TEXT NOT NULL DEFAULT 'Guest',
  message TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.room_messages TO anon, authenticated;
GRANT INSERT ON public.room_messages TO authenticated;
GRANT ALL ON public.room_messages TO service_role;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read room messages" ON public.room_messages FOR SELECT USING (true);
CREATE POLICY "Signed-in users can post messages" ON public.room_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============ GIFT EVENTS ============
CREATE TABLE public.gift_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL DEFAULT 'Guest',
  gift_id UUID REFERENCES public.gifts(id) ON DELETE SET NULL,
  gift_emoji TEXT NOT NULL,
  gift_name TEXT NOT NULL,
  coins INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gift_events TO anon, authenticated;
GRANT ALL ON public.gift_events TO service_role;
ALTER TABLE public.gift_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read gift events" ON public.gift_events FOR SELECT USING (true);

-- ============ SEED GIFTS ============
INSERT INTO public.gifts (name, emoji, price, category, animation, sort_order) VALUES
  ('Rose', '🌹', 10, 'popular', 'float', 1),
  ('Fireworks', '🎆', 350, 'popular', 'pop', 2),
  ('Diamond', '💎', 500, 'luxury', 'pop', 3),
  ('Sports Car', '🚗', 999, 'luxury', 'drive', 4),
  ('Crown', '👑', 2000, 'luxury', 'pop', 5),
  ('Unicorn', '🦄', 5000, 'premium', 'float', 6),
  ('Dragon', '🐉', 8800, 'premium', 'pop', 7),
  ('Castle', '🏰', 12000, 'premium', 'pop', 8);

-- ============ SEND GIFT (atomic) ============
CREATE OR REPLACE FUNCTION public.send_gift(_room_id UUID, _gift_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _gift public.gifts%ROWTYPE;
  _sender_name TEXT;
  _host UUID;
  _diamonds INTEGER;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to send gifts';
  END IF;

  SELECT * INTO _gift FROM public.gifts WHERE id = _gift_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gift not found';
  END IF;

  SELECT host_id INTO _host FROM public.rooms WHERE id = _room_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  -- deduct sender coins atomically
  UPDATE public.profiles
    SET coins = coins - _gift.price, updated_at = now()
    WHERE id = _uid AND coins >= _gift.price
    RETURNING username INTO _sender_name;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not enough coins';
  END IF;

  -- credit host diamonds (points) — 1 coin = 1 diamond for host
  _diamonds := _gift.price;
  UPDATE public.profiles
    SET diamonds = diamonds + _diamonds, updated_at = now()
    WHERE id = _host;

  -- bump room points + gift log
  UPDATE public.rooms SET total_points = total_points + _gift.price WHERE id = _room_id;

  INSERT INTO public.wallet_transactions (user_id, kind, coins, note)
    VALUES (_uid, 'gift', -_gift.price, 'Sent ' || _gift.name);

  INSERT INTO public.gift_events (room_id, sender_id, sender_name, gift_id, gift_emoji, gift_name, coins)
    VALUES (_room_id, _uid, COALESCE(_sender_name, 'Guest'), _gift.id, _gift.emoji, _gift.name, _gift.price);

  INSERT INTO public.room_messages (room_id, user_id, username, message, kind)
    VALUES (_room_id, _uid, COALESCE(_sender_name, 'Guest'), 'sent a ' || _gift.emoji || ' ' || _gift.name || '!', 'gift');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_gift(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_gift(UUID, UUID) TO authenticated;

-- ============ 20260705050902_38776774-a05f-430f-9579-3fb173c99d9b.sql ============
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS ludo_bet integer NOT NULL DEFAULT 100;

CREATE OR REPLACE FUNCTION public.ludo_place_bet(_room_id uuid, _bet integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _coins integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to play';
  END IF;
  IF _bet < 1 THEN
    RAISE EXCEPTION 'Invalid bet';
  END IF;

  UPDATE public.profiles
    SET coins = coins - _bet, updated_at = now()
    WHERE id = _uid AND coins >= _bet
    RETURNING coins INTO _coins;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not enough coins';
  END IF;

  INSERT INTO public.wallet_transactions (user_id, kind, coins, note)
    VALUES (_uid, 'ludo_bet', -_bet, 'Ludo bet');

  RETURN _coins;
END;
$$;

CREATE OR REPLACE FUNCTION public.ludo_payout(_bet integer, _players integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _coins integer;
  _pot integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sign in';
  END IF;

  _pot := GREATEST(_bet, 0) * GREATEST(_players, 1);

  UPDATE public.profiles
    SET coins = coins + _pot, updated_at = now()
    WHERE id = _uid
    RETURNING coins INTO _coins;

  INSERT INTO public.wallet_transactions (user_id, kind, coins, note)
    VALUES (_uid, 'ludo_win', _pot, 'Ludo winnings');

  RETURN _coins;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ludo_place_bet(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ludo_payout(integer, integer) TO authenticated;
-- ============ 20260705052200_751cb657-d22c-4230-84ec-c33010531f47.sql ============
-- Custom gift send with target (specific seat user or "All"), keeps real coin logic
CREATE OR REPLACE FUNCTION public.send_room_gift(
  _room_id uuid,
  _emoji text,
  _name text,
  _price integer,
  _target text DEFAULT 'Everyone'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _sender_name text;
  _host uuid;
  _coins integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to send gifts';
  END IF;
  IF _price < 1 THEN
    RAISE EXCEPTION 'Invalid gift';
  END IF;

  SELECT host_id INTO _host FROM public.rooms WHERE id = _room_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  UPDATE public.profiles
    SET coins = coins - _price, updated_at = now()
    WHERE id = _uid AND coins >= _price
    RETURNING username, coins INTO _sender_name, _coins;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not enough coins';
  END IF;

  UPDATE public.profiles
    SET diamonds = diamonds + _price, updated_at = now()
    WHERE id = _host;

  UPDATE public.rooms SET total_points = total_points + _price WHERE id = _room_id;

  INSERT INTO public.wallet_transactions (user_id, kind, coins, note)
    VALUES (_uid, 'gift', -_price, 'Sent ' || _name || ' to ' || _target);

  INSERT INTO public.room_messages (room_id, user_id, username, message, kind)
    VALUES (_room_id, _uid, COALESCE(_sender_name, 'Guest'),
            'sent ' || _emoji || ' ' || _name || ' to ' || _target || '!', 'gift');

  RETURN _coins;
END;
$$;

-- Private direct messages between users (friends chat)
CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own conversations"
  ON public.direct_messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users send messages"
  ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipients mark read"
  ON public.direct_messages FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

CREATE INDEX idx_direct_messages_pair ON public.direct_messages (sender_id, recipient_id, created_at);
CREATE INDEX idx_direct_messages_recipient ON public.direct_messages (recipient_id, created_at);
-- ============ 20260705053809_a64a8a8d-86fa-4eb4-a593-b0944c047204.sql ============
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS video_mode text NOT NULL DEFAULT 'solo',
  ADD COLUMN IF NOT EXISTS pk_battle boolean NOT NULL DEFAULT false;
-- ============ 20260706063010_608c9035-f321-454a-8430-69a4244c107b.sql ============
-- Singleton app settings table for splash screen control
CREATE TABLE public.app_settings (
  id text PRIMARY KEY DEFAULT 'global',
  splash_enabled boolean NOT NULL DEFAULT true,
  splash_image text,
  splash_duration integer NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 'global')
);

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read splash settings (needed on app open, unauthenticated)
CREATE POLICY "Anyone can read app settings"
  ON public.app_settings FOR SELECT
  USING (true);

-- Only admins can create/update settings
CREATE POLICY "Admins can insert app settings"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update app settings"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the singleton row
INSERT INTO public.app_settings (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;
-- ============ 20260706065549_56cbaf98-6c21-4f91-89da-efacaec80ee1.sql ============
CREATE TABLE public.room_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  avatar text,
  is_moderator boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_participants TO authenticated;
GRANT SELECT ON public.room_participants TO anon;
GRANT ALL ON public.room_participants TO service_role;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants are viewable by everyone"
  ON public.room_participants FOR SELECT USING (true);
CREATE POLICY "Users can join rooms"
  ON public.room_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own presence"
  ON public.room_participants FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave rooms"
  ON public.room_participants FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_room_participants_updated_at
  BEFORE UPDATE ON public.room_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.room_bans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.room_bans TO authenticated;
GRANT SELECT ON public.room_bans TO anon;
GRANT ALL ON public.room_bans TO service_role;
ALTER TABLE public.room_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bans are viewable by everyone"
  ON public.room_bans FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.room_set_moderator(_room_id uuid, _user_id uuid, _value boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _host uuid;
BEGIN
  SELECT host_id INTO _host FROM public.rooms WHERE id = _room_id;
  IF _host IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF auth.uid() <> _host THEN RAISE EXCEPTION 'Only the host can assign moderators'; END IF;
  UPDATE public.room_participants
    SET is_moderator = _value, updated_at = now()
    WHERE room_id = _room_id AND user_id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.room_kick_user(_room_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _host uuid; _is_mod boolean;
BEGIN
  SELECT host_id INTO _host FROM public.rooms WHERE id = _room_id;
  IF _host IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;
  SELECT is_moderator INTO _is_mod FROM public.room_participants
    WHERE room_id = _room_id AND user_id = auth.uid();
  IF auth.uid() <> _host AND COALESCE(_is_mod, false) = false THEN
    RAISE EXCEPTION 'Only the host or a moderator can remove users';
  END IF;
  IF _user_id = _host THEN RAISE EXCEPTION 'The host cannot be removed'; END IF;
  DELETE FROM public.room_participants WHERE room_id = _room_id AND user_id = _user_id;
  INSERT INTO public.room_bans (room_id, user_id)
    VALUES (_room_id, _user_id) ON CONFLICT DO NOTHING;
END;
$$;
-- ============ 20260706083131_54594a4f-af74-4d74-90cb-9d484a9806ef.sql ============
-- Track per-user received gift points inside a room
ALTER TABLE public.room_participants
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0;

-- Update gift function to credit the selected recipient (or everyone on stage)
CREATE OR REPLACE FUNCTION public.send_room_gift(_room_id uuid, _emoji text, _name text, _price integer, _target text DEFAULT 'Everyone'::text, _target_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _sender_name text;
  _host uuid;
  _coins integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to send gifts';
  END IF;
  IF _price < 1 THEN
    RAISE EXCEPTION 'Invalid gift';
  END IF;

  SELECT host_id INTO _host FROM public.rooms WHERE id = _room_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  UPDATE public.profiles
    SET coins = coins - _price, updated_at = now()
    WHERE id = _uid AND coins >= _price
    RETURNING username, coins INTO _sender_name, _coins;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not enough coins';
  END IF;

  UPDATE public.profiles
    SET diamonds = diamonds + _price, updated_at = now()
    WHERE id = _host;

  UPDATE public.rooms SET total_points = total_points + _price WHERE id = _room_id;

  -- Credit seat points: a specific recipient, or split across everyone on stage
  IF _target_id IS NOT NULL THEN
    UPDATE public.room_participants
      SET points = points + _price, updated_at = now()
      WHERE room_id = _room_id AND user_id = _target_id;
  ELSE
    UPDATE public.room_participants
      SET points = points + _price, updated_at = now()
      WHERE room_id = _room_id;
  END IF;

  INSERT INTO public.wallet_transactions (user_id, kind, coins, note)
    VALUES (_uid, 'gift', -_price, 'Sent ' || _name || ' to ' || _target);

  INSERT INTO public.room_messages (room_id, user_id, username, message, kind)
    VALUES (_room_id, _uid, COALESCE(_sender_name, 'Guest'),
            'sent ' || _emoji || ' ' || _name || ' to ' || _target || '!', 'gift');

  RETURN _coins;
END;
$function$;
-- ============ 20260706105546_689ad979-2196-41ab-bd13-1ae840dd838b.sql ============
-- 1. Presence: last_seen on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen timestamptz;

-- 2. Follows table
CREATE TABLE public.follows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view follows"
  ON public.follows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can follow"
  ON public.follows FOR INSERT
  TO authenticated
  WITH CHECK (follower_id = auth.uid());

CREATE POLICY "Users can unfollow"
  ON public.follows FOR DELETE
  TO authenticated
  USING (follower_id = auth.uid());

CREATE INDEX idx_follows_follower ON public.follows (follower_id);
CREATE INDEX idx_follows_following ON public.follows (following_id);

-- 3. One live voice room + one live video room per host
CREATE UNIQUE INDEX uniq_live_room_per_host_type
  ON public.rooms (host_id, room_type)
  WHERE is_live;
-- ============ 20260706115524_f18e05e9-d98a-4823-ae86-94663840bfd9.sql ============
-- ============ GALLERY IMAGES ============
CREATE TABLE public.gallery_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (path)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gallery_images TO authenticated;
GRANT ALL ON public.gallery_images TO service_role;

ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;

-- ============ GALLERY UNLOCKS (access requests) ============
CREATE TABLE public.gallery_unlocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, viewer_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gallery_unlocks TO authenticated;
GRANT ALL ON public.gallery_unlocks TO service_role;

ALTER TABLE public.gallery_unlocks ENABLE ROW LEVEL SECURITY;

-- ============ ACCESS HELPER ============
CREATE OR REPLACE FUNCTION public.has_gallery_access(_owner UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _owner = auth.uid() OR EXISTS (
    SELECT 1 FROM public.gallery_unlocks
    WHERE owner_id = _owner AND viewer_id = auth.uid() AND status = 'accepted'
  )
$$;

-- ============ LIMIT ENFORCEMENT ============
CREATE OR REPLACE FUNCTION public.enforce_gallery_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _pub INT; _priv INT;
BEGIN
  SELECT count(*) FILTER (WHERE is_public),
         count(*) FILTER (WHERE NOT is_public)
    INTO _pub, _priv
    FROM public.gallery_images
    WHERE user_id = NEW.user_id AND id <> NEW.id;
  IF NEW.is_public AND _pub >= 5 THEN
    RAISE EXCEPTION 'You can only have 5 public photos';
  END IF;
  IF NOT NEW.is_public AND _priv >= 5 THEN
    RAISE EXCEPTION 'You can only have 5 private photos';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_gallery_limits
  BEFORE INSERT OR UPDATE ON public.gallery_images
  FOR EACH ROW EXECUTE FUNCTION public.enforce_gallery_limits();

CREATE TRIGGER trg_gallery_images_updated
  BEFORE UPDATE ON public.gallery_images
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_gallery_unlocks_updated
  BEFORE UPDATE ON public.gallery_unlocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RLS: gallery_images ============
CREATE POLICY "View public, own, or unlocked photos"
  ON public.gallery_images FOR SELECT
  TO authenticated
  USING (is_public OR user_id = auth.uid() OR public.has_gallery_access(user_id));

CREATE POLICY "Owners insert own photos"
  ON public.gallery_images FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners update own photos"
  ON public.gallery_images FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners delete own photos"
  ON public.gallery_images FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============ RLS: gallery_unlocks ============
CREATE POLICY "Owner or viewer can see requests"
  ON public.gallery_unlocks FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR viewer_id = auth.uid());

CREATE POLICY "Viewer creates own request"
  ON public.gallery_unlocks FOR INSERT
  TO authenticated
  WITH CHECK (viewer_id = auth.uid() AND owner_id <> auth.uid());

CREATE POLICY "Owner updates requests to them"
  ON public.gallery_unlocks FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner or viewer deletes request"
  ON public.gallery_unlocks FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() OR viewer_id = auth.uid());

-- ============ STORAGE object policies (bucket created separately) ============
CREATE OR REPLACE FUNCTION public.gallery_object_visible(_path TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gallery_images gi
    WHERE gi.path = _path
      AND (
        gi.is_public
        OR gi.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.gallery_unlocks gu
          WHERE gu.owner_id = gi.user_id
            AND gu.viewer_id = auth.uid()
            AND gu.status = 'accepted'
        )
      )
  )
$$;

CREATE POLICY "Gallery owners manage own files"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'gallery' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'gallery' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Gallery view allowed files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'gallery' AND public.gallery_object_visible(name));
-- ============ 20260706123654_8626d3a0-63b8-4ba3-b42a-e8191c8ec572.sql ============

-- ========== THEMES ==========
CREATE TABLE public.themes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_free BOOLEAN NOT NULL DEFAULT false,
  price INTEGER NOT NULL DEFAULT 0,
  bg_image TEXT,
  primary_color TEXT NOT NULL DEFAULT '#e94560',
  accent_color TEXT NOT NULL DEFAULT '#9b72cf',
  sort INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.themes TO anon, authenticated;
GRANT ALL ON public.themes TO service_role;
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active themes" ON public.themes
  FOR SELECT USING (is_active OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage themes" ON public.themes
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER themes_updated_at BEFORE UPDATE ON public.themes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== USER OWNED THEMES ==========
CREATE TABLE public.user_themes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_id UUID NOT NULL REFERENCES public.themes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, theme_id)
);
GRANT SELECT ON public.user_themes TO authenticated;
GRANT ALL ON public.user_themes TO service_role;
ALTER TABLE public.user_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own themes" ON public.user_themes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ========== PROFILE ACTIVE THEME ==========
ALTER TABLE public.profiles
  ADD COLUMN theme_id UUID REFERENCES public.themes(id) ON DELETE SET NULL;

-- ========== VIP TIERS ==========
CREATE TABLE public.vip_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 30,
  level_boost INTEGER NOT NULL DEFAULT 0,
  badge_emoji TEXT NOT NULL DEFAULT '👑',
  perks TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vip_tiers TO anon, authenticated;
GRANT ALL ON public.vip_tiers TO service_role;
ALTER TABLE public.vip_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active vip tiers" ON public.vip_tiers
  FOR SELECT USING (is_active OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage vip tiers" ON public.vip_tiers
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER vip_tiers_updated_at BEFORE UPDATE ON public.vip_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== PURCHASE THEME ==========
CREATE OR REPLACE FUNCTION public.purchase_theme(_theme_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _theme public.themes%ROWTYPE;
  _owns BOOLEAN;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in to buy themes'; END IF;
  SELECT * INTO _theme FROM public.themes WHERE id = _theme_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Theme not found'; END IF;

  SELECT EXISTS(SELECT 1 FROM public.user_themes WHERE user_id = _uid AND theme_id = _theme_id)
    INTO _owns;

  IF NOT _owns AND NOT _theme.is_free THEN
    UPDATE public.profiles
      SET coins = coins - _theme.price, updated_at = now()
      WHERE id = _uid AND coins >= _theme.price;
    IF NOT FOUND THEN RAISE EXCEPTION 'Not enough coins'; END IF;
    INSERT INTO public.wallet_transactions (user_id, kind, coins, note)
      VALUES (_uid, 'theme', -_theme.price, 'Bought theme ' || _theme.name);
  END IF;

  INSERT INTO public.user_themes (user_id, theme_id)
    VALUES (_uid, _theme_id) ON CONFLICT DO NOTHING;

  UPDATE public.profiles SET theme_id = _theme_id, updated_at = now() WHERE id = _uid;
END;
$$;

-- ========== EQUIP THEME ==========
CREATE OR REPLACE FUNCTION public.equip_theme(_theme_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _is_free BOOLEAN;
  _owns BOOLEAN;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in'; END IF;
  IF _theme_id IS NULL THEN
    UPDATE public.profiles SET theme_id = NULL, updated_at = now() WHERE id = _uid;
    RETURN;
  END IF;
  SELECT is_free INTO _is_free FROM public.themes WHERE id = _theme_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Theme not found'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_themes WHERE user_id = _uid AND theme_id = _theme_id)
    INTO _owns;
  IF NOT _is_free AND NOT _owns THEN
    RAISE EXCEPTION 'You do not own this theme';
  END IF;
  UPDATE public.profiles SET theme_id = _theme_id, updated_at = now() WHERE id = _uid;
END;
$$;

-- ========== PURCHASE VIP ==========
CREATE OR REPLACE FUNCTION public.purchase_vip(_tier_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _tier public.vip_tiers%ROWTYPE;
  _base TIMESTAMPTZ;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in to buy VIP'; END IF;
  SELECT * INTO _tier FROM public.vip_tiers WHERE id = _tier_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'VIP tier not found'; END IF;

  UPDATE public.profiles
    SET coins = coins - _tier.price
    WHERE id = _uid AND coins >= _tier.price;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not enough coins'; END IF;

  SELECT GREATEST(now(), COALESCE(vip_expiry, now())) INTO _base
    FROM public.profiles WHERE id = _uid;

  UPDATE public.profiles
    SET is_vip = true,
        vip_expiry = _base + (_tier.duration_days || ' days')::interval,
        level = level + _tier.level_boost,
        updated_at = now()
    WHERE id = _uid;

  INSERT INTO public.wallet_transactions (user_id, kind, coins, note)
    VALUES (_uid, 'vip', -_tier.price, 'Bought VIP ' || _tier.name);
END;
$$;

-- ============ 20260706123738_fe15dce3-e3af-49ae-93dc-8be3e6b124c9.sql ============

CREATE POLICY "Public can view theme images" ON storage.objects
  FOR SELECT USING (bucket_id = 'themes');
CREATE POLICY "Admins upload theme images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'themes' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins update theme images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'themes' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins delete theme images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'themes' AND public.is_admin(auth.uid()));

-- ============ 20260706124608_adeac1e1-c034-422a-9143-310249e92727.sql ============

DROP POLICY IF EXISTS "Anyone can view active themes" ON public.themes;
CREATE POLICY "Anyone can view active themes" ON public.themes
  FOR SELECT USING (is_active);

DROP POLICY IF EXISTS "Anyone can view active vip tiers" ON public.vip_tiers;
CREATE POLICY "Anyone can view active vip tiers" ON public.vip_tiers
  FOR SELECT USING (is_active);

-- ============ 20260706124727_f6a461b7-90aa-4c48-b730-e8f2528e6ff8.sql ============

CREATE OR REPLACE FUNCTION public.admin_update_user(
  _user_id UUID,
  _level INTEGER,
  _coins BIGINT,
  _is_vip BOOLEAN,
  _status TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can update users';
  END IF;
  UPDATE public.profiles
    SET level = GREATEST(1, _level),
        coins = GREATEST(0, _coins),
        is_vip = _is_vip,
        vip_expiry = CASE
          WHEN _is_vip AND (vip_expiry IS NULL OR vip_expiry < now())
            THEN now() + interval '30 days'
          WHEN NOT _is_vip THEN NULL
          ELSE vip_expiry END,
        status = _status,
        updated_at = now()
    WHERE id = _user_id;
END;
$$;

-- ============ 20260706125431_c7f0f770-a6ab-4909-8878-fe579d798aff.sql ============
-- Storage policies for the private avatars bucket.
-- Users manage files inside a folder named after their own user id.
CREATE POLICY "Avatar owner can read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Avatar owner can insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Avatar owner can update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Avatar owner can delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
-- ============ 20260706132140_82e8ced7-b97b-4686-918b-321ce70e8a9c.sql ============

-- 1) App settings: prices + platform balance
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS coin_price_pkr numeric(10,4) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS diamond_price_pkr numeric(10,4) NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS platform_diamonds bigint NOT NULL DEFAULT 0;

-- 2) Withdrawal requests
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  diamonds bigint NOT NULL,
  amount_pkr numeric(10,2) NOT NULL,
  method pay_method NOT NULL DEFAULT 'manual',
  account_number text,
  account_name text,
  status recharge_status NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own withdrawals" ON public.withdrawal_requests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own withdrawals" ON public.withdrawal_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view withdrawals" ON public.withdrawal_requests
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage withdrawals" ON public.withdrawal_requests
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 3) Gift split helper baked into gift RPCs (60% host / 40% platform)
CREATE OR REPLACE FUNCTION public.send_gift(_room_id uuid, _gift_id uuid)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _gift public.gifts%ROWTYPE;
  _sender_name TEXT;
  _host UUID;
  _host_share bigint;
  _admin_share bigint;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in to send gifts'; END IF;
  SELECT * INTO _gift FROM public.gifts WHERE id = _gift_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gift not found'; END IF;
  SELECT host_id INTO _host FROM public.rooms WHERE id = _room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;

  UPDATE public.profiles SET coins = coins - _gift.price, updated_at = now()
    WHERE id = _uid AND coins >= _gift.price RETURNING username INTO _sender_name;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not enough coins'; END IF;

  _host_share := floor(_gift.price * 0.6);
  _admin_share := _gift.price - _host_share;
  UPDATE public.profiles SET diamonds = diamonds + _host_share, updated_at = now() WHERE id = _host;
  UPDATE public.app_settings SET platform_diamonds = platform_diamonds + _admin_share WHERE id = 'global';

  UPDATE public.rooms SET total_points = total_points + _gift.price WHERE id = _room_id;

  INSERT INTO public.wallet_transactions (user_id, kind, coins, note)
    VALUES (_uid, 'gift', -_gift.price, 'Sent ' || _gift.name);
  INSERT INTO public.wallet_transactions (user_id, kind, diamonds, note)
    VALUES (_host, 'gift_earning', _host_share, 'Received ' || _gift.name);
  INSERT INTO public.gift_events (room_id, sender_id, sender_name, gift_id, gift_emoji, gift_name, coins)
    VALUES (_room_id, _uid, COALESCE(_sender_name, 'Guest'), _gift.id, _gift.emoji, _gift.name, _gift.price);
  INSERT INTO public.room_messages (room_id, user_id, username, message, kind)
    VALUES (_room_id, _uid, COALESCE(_sender_name, 'Guest'), 'sent a ' || _gift.emoji || ' ' || _gift.name || '!', 'gift');
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_room_gift(_room_id uuid, _emoji text, _name text, _price integer, _target text DEFAULT 'Everyone'::text, _target_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _sender_name text;
  _host uuid;
  _coins integer;
  _host_share bigint;
  _admin_share bigint;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in to send gifts'; END IF;
  IF _price < 1 THEN RAISE EXCEPTION 'Invalid gift'; END IF;

  SELECT host_id INTO _host FROM public.rooms WHERE id = _room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;

  UPDATE public.profiles SET coins = coins - _price, updated_at = now()
    WHERE id = _uid AND coins >= _price RETURNING username, coins INTO _sender_name, _coins;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not enough coins'; END IF;

  _host_share := floor(_price * 0.6);
  _admin_share := _price - _host_share;
  UPDATE public.profiles SET diamonds = diamonds + _host_share, updated_at = now() WHERE id = _host;
  UPDATE public.app_settings SET platform_diamonds = platform_diamonds + _admin_share WHERE id = 'global';

  UPDATE public.rooms SET total_points = total_points + _price WHERE id = _room_id;

  IF _target_id IS NOT NULL THEN
    UPDATE public.room_participants SET points = points + _price, updated_at = now()
      WHERE room_id = _room_id AND user_id = _target_id;
  ELSE
    UPDATE public.room_participants SET points = points + _price, updated_at = now()
      WHERE room_id = _room_id;
  END IF;

  INSERT INTO public.wallet_transactions (user_id, kind, coins, note)
    VALUES (_uid, 'gift', -_price, 'Sent ' || _name || ' to ' || _target);
  INSERT INTO public.wallet_transactions (user_id, kind, diamonds, note)
    VALUES (_host, 'gift_earning', _host_share, 'Received ' || _name);
  INSERT INTO public.room_messages (room_id, user_id, username, message, kind)
    VALUES (_room_id, _uid, COALESCE(_sender_name, 'Guest'),
            'sent ' || _emoji || ' ' || _name || ' to ' || _target || '!', 'gift');

  RETURN _coins;
END;
$function$;

-- 4) Withdrawal RPCs
CREATE OR REPLACE FUNCTION public.request_withdrawal(_diamonds bigint, _method pay_method, _account_number text, _account_name text)
 RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _rate numeric;
  _amount numeric;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in to withdraw'; END IF;
  IF _diamonds < 1 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  SELECT diamond_price_pkr INTO _rate FROM public.app_settings WHERE id = 'global';
  _amount := ROUND(_diamonds * COALESCE(_rate, 0.5), 2);

  UPDATE public.profiles SET diamonds = diamonds - _diamonds, updated_at = now()
    WHERE id = _uid AND diamonds >= _diamonds;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not enough diamonds'; END IF;

  INSERT INTO public.withdrawal_requests (user_id, diamonds, amount_pkr, method, account_number, account_name)
    VALUES (_uid, _diamonds, _amount, _method, _account_number, _account_name)
    RETURNING id INTO _id;

  INSERT INTO public.wallet_transactions (user_id, kind, diamonds, note)
    VALUES (_uid, 'withdraw', -_diamonds, 'Withdrawal requested');

  RETURN _id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_withdrawal(_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can approve withdrawals'; END IF;
  UPDATE public.withdrawal_requests SET status = 'approved', processed_at = now()
    WHERE id = _request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found or already processed'; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_withdrawal(_request_id uuid, _note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _req public.withdrawal_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can reject withdrawals'; END IF;
  SELECT * INTO _req FROM public.withdrawal_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'Withdrawal already processed'; END IF;

  UPDATE public.withdrawal_requests SET status = 'rejected', processed_at = now(), admin_note = _note
    WHERE id = _request_id;
  -- refund the held diamonds
  UPDATE public.profiles SET diamonds = diamonds + _req.diamonds, updated_at = now() WHERE id = _req.user_id;
  INSERT INTO public.wallet_transactions (user_id, kind, diamonds, note)
    VALUES (_req.user_id, 'withdraw_refund', _req.diamonds, 'Withdrawal rejected — refunded');
END;
$function$;

-- 5) Grant admin to admin@jalwa.pro on verified email
CREATE OR REPLACE FUNCTION public.grant_admin_for_jalwa()
 RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND lower(NEW.email) = 'admin@jalwa.pro' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_jalwa ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_jalwa
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_jalwa();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_jalwa ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_grant_jalwa
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.grant_admin_for_jalwa();

-- apply immediately if the account already exists and is confirmed
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::app_role FROM auth.users
WHERE lower(email) = 'admin@jalwa.pro' AND email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- ============ 20260706132314_cd761185-789d-4d5e-baca-de8e8b12b2a6.sql ============

GRANT SELECT, DELETE ON public.room_bans TO authenticated;

DROP POLICY IF EXISTS "Host can remove bans" ON public.room_bans;
CREATE POLICY "Host can remove bans" ON public.room_bans
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_bans.room_id AND r.host_id = auth.uid()));

-- ============ 20260706134500_2b043695-f3c0-4494-a07e-d7f762f1a261.sql ============
-- 1) New users start at level 0
ALTER TABLE public.profiles ALTER COLUMN level SET DEFAULT 0;

-- Allow admins to set level as low as 0
CREATE OR REPLACE FUNCTION public.admin_update_user(_user_id uuid, _level integer, _coins bigint, _is_vip boolean, _status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can update users';
  END IF;
  UPDATE public.profiles
    SET level = GREATEST(0, _level),
        coins = GREATEST(0, _coins),
        is_vip = _is_vip,
        vip_expiry = CASE
          WHEN _is_vip AND (vip_expiry IS NULL OR vip_expiry < now())
            THEN now() + interval '30 days'
          WHEN NOT _is_vip THEN NULL
          ELSE vip_expiry END,
        status = _status,
        updated_at = now()
    WHERE id = _user_id;
END;
$function$;

-- 2) Track when a room stopped being live (for active duration)
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS ended_at timestamp with time zone;
-- Backfill: rooms already ended get their last update time as end time
UPDATE public.rooms SET ended_at = updated_at WHERE is_live = false AND ended_at IS NULL;

-- 3) PK battle history (win / lose / draw records per host)
CREATE TABLE IF NOT EXISTS public.pk_battles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  room_title text NOT NULL DEFAULT 'PK Battle',
  my_score bigint NOT NULL DEFAULT 0,
  opponent_name text NOT NULL DEFAULT 'Opponent',
  opponent_score bigint NOT NULL DEFAULT 0,
  result text NOT NULL DEFAULT 'draw',
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pk_battles TO authenticated;
GRANT ALL ON public.pk_battles TO service_role;

ALTER TABLE public.pk_battles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own PK battles"
  ON public.pk_battles FOR SELECT TO authenticated
  USING (auth.uid() = host_id);

CREATE POLICY "Users can record their own PK battles"
  ON public.pk_battles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Users can delete their own PK battles"
  ON public.pk_battles FOR DELETE TO authenticated
  USING (auth.uid() = host_id);
-- ============ 20260706135421_40a3222d-b934-493c-a897-e9654dd239ce.sql ============
-- Profile: when the equipped frame expires
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS frame_expires_at timestamp with time zone;

-- DP frame catalog
CREATE TABLE IF NOT EXISTS public.dp_frames (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  price integer NOT NULL DEFAULT 0,
  from_color text NOT NULL DEFAULT '#5cbdff',
  to_color text NOT NULL DEFAULT '#1a6bc4',
  glow text NOT NULL DEFAULT '92,189,255',
  effect text NOT NULL DEFAULT 'ring',
  duration_days integer NOT NULL DEFAULT 7,
  is_active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dp_frames TO authenticated;
GRANT SELECT ON public.dp_frames TO anon;
GRANT ALL ON public.dp_frames TO service_role;

ALTER TABLE public.dp_frames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active DP frames"
  ON public.dp_frames FOR SELECT
  USING (is_active OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage DP frames"
  ON public.dp_frames FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_dp_frames_updated_at
  BEFORE UPDATE ON public.dp_frames
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Owned (temporary) frames
CREATE TABLE IF NOT EXISTS public.user_frames (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  frame_id uuid NOT NULL REFERENCES public.dp_frames(id) ON DELETE CASCADE,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, frame_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_frames TO authenticated;
GRANT ALL ON public.user_frames TO service_role;

ALTER TABLE public.user_frames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own frames"
  ON public.user_frames FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Buy a frame for its duration (temporary), then apply it
CREATE OR REPLACE FUNCTION public.purchase_frame(_frame_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _frame public.dp_frames%ROWTYPE;
  _base timestamptz;
  _expiry timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in to buy frames'; END IF;
  SELECT * INTO _frame FROM public.dp_frames WHERE id = _frame_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Frame not found'; END IF;

  IF _frame.price > 0 THEN
    UPDATE public.profiles SET coins = coins - _frame.price, updated_at = now()
      WHERE id = _uid AND coins >= _frame.price;
    IF NOT FOUND THEN RAISE EXCEPTION 'Not enough coins'; END IF;
    INSERT INTO public.wallet_transactions (user_id, kind, coins, note)
      VALUES (_uid, 'frame', -_frame.price, 'Bought frame ' || _frame.name);
  END IF;

  -- extend from current expiry if still active
  SELECT GREATEST(now(), COALESCE(expires_at, now())) INTO _base
    FROM public.user_frames WHERE user_id = _uid AND frame_id = _frame_id;
  IF _base IS NULL THEN _base := now(); END IF;
  _expiry := _base + (_frame.duration_days || ' days')::interval;

  INSERT INTO public.user_frames (user_id, frame_id, expires_at)
    VALUES (_uid, _frame_id, _expiry)
    ON CONFLICT (user_id, frame_id)
    DO UPDATE SET expires_at = _expiry;

  UPDATE public.profiles
    SET frame = _frame_id::text, frame_expires_at = _expiry, updated_at = now()
    WHERE id = _uid;
END;
$function$;

-- Apply an owned, non-expired frame (or clear with NULL)
CREATE OR REPLACE FUNCTION public.equip_frame(_frame_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _expiry timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in'; END IF;
  IF _frame_id IS NULL THEN
    UPDATE public.profiles SET frame = NULL, frame_expires_at = NULL, updated_at = now() WHERE id = _uid;
    RETURN;
  END IF;
  SELECT expires_at INTO _expiry FROM public.user_frames
    WHERE user_id = _uid AND frame_id = _frame_id;
  IF NOT FOUND OR _expiry <= now() THEN
    RAISE EXCEPTION 'You do not own this frame or it has expired';
  END IF;
  UPDATE public.profiles
    SET frame = _frame_id::text, frame_expires_at = _expiry, updated_at = now()
    WHERE id = _uid;
END;
$function$;

-- Seed starter frames
INSERT INTO public.dp_frames (name, description, price, from_color, to_color, glow, effect, duration_days, sort)
VALUES
  ('Neon Blue', 'Glowing neon halo', 500, '#5cbdff', '#1a6bc4', '92,189,255', 'neon', 7, 1),
  ('Emerald Glow', 'Fresh green shimmer', 800, '#2ecc71', '#146b3a', '46,204,113', 'neon', 7, 2),
  ('Ruby Flame', 'Fiery red aura', 800, '#ff4757', '#a01020', '255,71,87', 'neon', 7, 3),
  ('Golden Royal', 'Sparkling gold crown', 1200, '#f5c542', '#b8860b', '245,197,66', 'sparkle', 7, 4),
  ('Purple Mystic', 'Mystic violet sparkles', 1500, '#b06bff', '#6a1fb0', '176,107,255', 'sparkle', 7, 5),
  ('Rainbow Prism', 'Ultimate rainbow shine', 2000, '#ff4dab', '#2ee6d0', '255,77,171', 'sparkle', 7, 6);
-- ============ 20260706135807_eb1646ec-5f84-4d77-83ea-5b53e95f8640.sql ============
DROP POLICY IF EXISTS "Anyone can view active DP frames" ON public.dp_frames;

CREATE POLICY "View active DP frames"
  ON public.dp_frames FOR SELECT
  USING (is_active);
-- ============ 20260706140137_dc98cb92-6beb-4c26-b7ed-dea17def2c05.sql ============
-- ============ Room Backgrounds catalog ============
CREATE TABLE public.room_backgrounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.room_backgrounds TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.room_backgrounds TO authenticated;
GRANT ALL ON public.room_backgrounds TO service_role;
ALTER TABLE public.room_backgrounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views active room backgrounds" ON public.room_backgrounds FOR SELECT TO authenticated USING (is_active OR public.is_admin(auth.uid()));
CREATE POLICY "Anon views active room backgrounds" ON public.room_backgrounds FOR SELECT TO anon USING (is_active);
CREATE POLICY "Admins manage room backgrounds" ON public.room_backgrounds FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ Ads Management ============
CREATE TABLE public.ads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT,
  link_url TEXT,
  placement TEXT NOT NULL DEFAULT 'home',
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ads TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ads TO authenticated;
GRANT ALL ON public.ads TO service_role;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authed views active ads" ON public.ads FOR SELECT TO authenticated USING (is_active OR public.is_admin(auth.uid()));
CREATE POLICY "Anon views active ads" ON public.ads FOR SELECT TO anon USING (is_active);
CREATE POLICY "Admins manage ads" ON public.ads FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ CMS / Content pages ============
CREATE TABLE public.cms_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cms_pages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cms_pages TO authenticated;
GRANT ALL ON public.cms_pages TO service_role;
ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authed views published pages" ON public.cms_pages FOR SELECT TO authenticated USING (is_published OR public.is_admin(auth.uid()));
CREATE POLICY "Anon views published pages" ON public.cms_pages FOR SELECT TO anon USING (is_published);
CREATE POLICY "Admins manage cms pages" ON public.cms_pages FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ Support Center ============
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  admin_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own tickets" ON public.support_tickets FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Users create tickets" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage tickets" ON public.support_tickets FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete tickets" ON public.support_tickets FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- ============ User Reports (Report Center) ============
CREATE TABLE public.user_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  room_id UUID,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_reports TO authenticated;
GRANT ALL ON public.user_reports TO service_role;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own reports" ON public.user_reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id OR public.is_admin(auth.uid()));
CREATE POLICY "Users create reports" ON public.user_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins manage reports" ON public.user_reports FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete reports" ON public.user_reports FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- ============ Admin Logs ============
CREATE TABLE public.admin_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_logs TO authenticated;
GRANT ALL ON public.admin_logs TO service_role;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view logs" ON public.admin_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert logs" ON public.admin_logs FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

-- ============ Theme Categories ============
CREATE TABLE public.theme_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.theme_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.theme_categories TO authenticated;
GRANT ALL ON public.theme_categories TO service_role;
ALTER TABLE public.theme_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views active theme categories" ON public.theme_categories FOR SELECT TO authenticated USING (is_active OR public.is_admin(auth.uid()));
CREATE POLICY "Anon views active theme categories" ON public.theme_categories FOR SELECT TO anon USING (is_active);
CREATE POLICY "Admins manage theme categories" ON public.theme_categories FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ updated_at triggers ============
CREATE TRIGGER trg_room_backgrounds_updated BEFORE UPDATE ON public.room_backgrounds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ads_updated BEFORE UPDATE ON public.ads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cms_pages_updated BEFORE UPDATE ON public.cms_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_support_tickets_updated BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_user_reports_updated BEFORE UPDATE ON public.user_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_theme_categories_updated BEFORE UPDATE ON public.theme_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- ============ 20260706141901_27af36c7-f6e1-43ca-9d18-a6fab9825f92.sql ============
-- Gift categories table so admins can organise gifts in the shop / room gift picker
CREATE TABLE public.gift_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT '🎁',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.gift_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_categories TO authenticated;
GRANT ALL ON public.gift_categories TO service_role;

ALTER TABLE public.gift_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone views active gift categories"
  ON public.gift_categories FOR SELECT TO anon, authenticated
  USING (is_active OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage gift categories"
  ON public.gift_categories FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_gift_categories_updated_at
  BEFORE UPDATE ON public.gift_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed categories (slug matches the gifts.category text column)
INSERT INTO public.gift_categories (slug, name, icon, sort_order) VALUES
  ('popular',  'Popular',  '🔥', 0),
  ('flowers',  'Flowers',  '🌸', 1),
  ('love',     'Love',     '❤️', 2),
  ('luxury',   'Luxury',   '💎', 3),
  ('vehicles', 'Vehicles', '🚗', 4),
  ('animals',  'Animals',  '🦄', 5),
  ('sweets',   'Sweets',   '🍰', 6),
  ('party',    'Party',    '🎉', 7),
  ('cosmic',   'Cosmic',   '✨', 8),
  ('premium',  'Premium',  '👑', 9)
ON CONFLICT (slug) DO NOTHING;
-- ============ 20260706143616_f0bc5287-058b-470c-94ca-83d468011232.sql ============
-- Gift media: image icon + animated/mp4 clip (TikTok-style)
ALTER TABLE public.gifts
  ADD COLUMN IF NOT EXISTS icon_path text,
  ADD COLUMN IF NOT EXISTS clip_path text,
  ADD COLUMN IF NOT EXISTS clip_type text NOT NULL DEFAULT 'mp4';

-- Storage RLS for the private "gifts" bucket
CREATE POLICY "Authenticated can view gift media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'gifts');

CREATE POLICY "Admins can upload gift media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gifts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update gift media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'gifts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete gift media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'gifts' AND public.has_role(auth.uid(), 'admin'));

-- Broadcast gifts to everyone in the room via gift_events, carrying gift_id
-- so clients can play the gift's uploaded clip full-screen for all viewers.
CREATE OR REPLACE FUNCTION public.send_room_gift(
  _room_id uuid, _emoji text, _name text, _price integer,
  _target text DEFAULT 'Everyone'::text, _target_id uuid DEFAULT NULL::uuid,
  _gift_id uuid DEFAULT NULL::uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _sender_name text;
  _host uuid;
  _coins integer;
  _host_share bigint;
  _admin_share bigint;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in to send gifts'; END IF;
  IF _price < 1 THEN RAISE EXCEPTION 'Invalid gift'; END IF;

  SELECT host_id INTO _host FROM public.rooms WHERE id = _room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;

  UPDATE public.profiles SET coins = coins - _price, updated_at = now()
    WHERE id = _uid AND coins >= _price RETURNING username, coins INTO _sender_name, _coins;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not enough coins'; END IF;

  _host_share := floor(_price * 0.6);
  _admin_share := _price - _host_share;
  UPDATE public.profiles SET diamonds = diamonds + _host_share, updated_at = now() WHERE id = _host;
  UPDATE public.app_settings SET platform_diamonds = platform_diamonds + _admin_share WHERE id = 'global';

  UPDATE public.rooms SET total_points = total_points + _price WHERE id = _room_id;

  IF _target_id IS NOT NULL THEN
    UPDATE public.room_participants SET points = points + _price, updated_at = now()
      WHERE room_id = _room_id AND user_id = _target_id;
  ELSE
    UPDATE public.room_participants SET points = points + _price, updated_at = now()
      WHERE room_id = _room_id;
  END IF;

  INSERT INTO public.wallet_transactions (user_id, kind, coins, note)
    VALUES (_uid, 'gift', -_price, 'Sent ' || _name || ' to ' || _target);
  INSERT INTO public.wallet_transactions (user_id, kind, diamonds, note)
    VALUES (_host, 'gift_earning', _host_share, 'Received ' || _name);
  INSERT INTO public.room_messages (room_id, user_id, username, message, kind)
    VALUES (_room_id, _uid, COALESCE(_sender_name, 'Guest'),
            'sent ' || _emoji || ' ' || _name || ' to ' || _target || '!', 'gift');
  INSERT INTO public.gift_events (room_id, sender_id, sender_name, gift_id, gift_emoji, gift_name, coins)
    VALUES (_room_id, _uid, COALESCE(_sender_name, 'Guest'), _gift_id, _emoji, _name, _price);

  RETURN _coins;
END;
$function$;
-- ============ 20260706144159_6da99a89-a602-4093-8008-a0970b8edce0.sql ============
-- Allow room clients to read the gift broadcast feed (policy is already public)
GRANT SELECT ON public.gift_events TO anon, authenticated;
GRANT ALL ON public.gift_events TO service_role;
-- ============ 20260706144729_e7f2a6ac-39c9-41bf-9b73-be83ae10780a.sql ============
-- ========== Free-friend accounts ==========
-- Their coins are gifted free: excluded from revenue reports & cannot withdraw.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false;

-- ========== Partners (revenue-share) ==========
CREATE TABLE IF NOT EXISTS public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  percentage numeric NOT NULL DEFAULT 0,
  note text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partners TO authenticated;
GRANT ALL ON public.partners TO service_role;

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view own, admins all"
  ON public.partners FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Admins insert partners"
  ON public.partners FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update partners"
  ON public.partners FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete partners"
  ON public.partners FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER partners_updated_at BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== Admin: toggle a free-friend account ==========
CREATE OR REPLACE FUNCTION public.admin_set_free_account(_user_id uuid, _value boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can change free accounts'; END IF;
  UPDATE public.profiles SET is_free = _value, updated_at = now() WHERE id = _user_id;
END; $$;

-- ========== Partner dashboard stats ==========
CREATE OR REPLACE FUNCTION public.partner_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _pct numeric;
  _active boolean;
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in'; END IF;
  SELECT percentage, is_active INTO _pct, _active FROM public.partners WHERE user_id = _uid;
  IF _pct IS NULL THEN RAISE EXCEPTION 'You are not a partner'; END IF;

  WITH approved AS (
    SELECT r.amount_paid, r.coins, COALESCE(r.processed_at, r.created_at) AS at
    FROM public.recharge_requests r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.status = 'approved' AND COALESCE(p.is_free, false) = false
  ),
  totals AS (SELECT COALESCE(SUM(amount_paid),0) rev, COALESCE(SUM(coins),0) coins FROM approved),
  today AS (SELECT COALESCE(SUM(amount_paid),0) rev, COALESCE(SUM(coins),0) coins FROM approved WHERE at >= date_trunc('day', now())),
  daily AS (
    SELECT to_char(date_trunc('day', at), 'YYYY-MM-DD') AS d,
           COALESCE(SUM(amount_paid),0) rev, COALESCE(SUM(coins),0) coins
    FROM approved WHERE at >= now() - interval '7 days'
    GROUP BY 1 ORDER BY 1 DESC
  )
  SELECT jsonb_build_object(
    'percentage', _pct,
    'is_active', COALESCE(_active, false),
    'total_revenue', (SELECT rev FROM totals),
    'total_coins', (SELECT coins FROM totals),
    'total_profit', round((SELECT rev FROM totals) * _pct / 100.0, 2),
    'today_revenue', (SELECT rev FROM today),
    'today_coins', (SELECT coins FROM today),
    'today_profit', round((SELECT rev FROM today) * _pct / 100.0, 2),
    'daily', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'day', d, 'revenue', rev, 'coins', coins,
        'profit', round(rev * _pct / 100.0, 2))) FROM daily), '[]'::jsonb)
  ) INTO _result;
  RETURN _result;
END; $$;

-- ========== Block withdrawals for free-friend accounts ==========
CREATE OR REPLACE FUNCTION public.request_withdrawal(_diamonds bigint, _method pay_method, _account_number text, _account_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _rate numeric;
  _amount numeric;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in to withdraw'; END IF;
  IF _diamonds < 1 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND is_free) THEN
    RAISE EXCEPTION 'Free accounts cannot withdraw';
  END IF;

  SELECT diamond_price_pkr INTO _rate FROM public.app_settings WHERE id = 'global';
  _amount := ROUND(_diamonds * COALESCE(_rate, 0.5), 2);

  UPDATE public.profiles SET diamonds = diamonds - _diamonds, updated_at = now()
    WHERE id = _uid AND diamonds >= _diamonds;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not enough diamonds'; END IF;

  INSERT INTO public.withdrawal_requests (user_id, diamonds, amount_pkr, method, account_number, account_name)
    VALUES (_uid, _diamonds, _amount, _method, _account_number, _account_name)
    RETURNING id INTO _id;

  INSERT INTO public.wallet_transactions (user_id, kind, diamonds, note)
    VALUES (_uid, 'withdraw', -_diamonds, 'Withdrawal requested');

  RETURN _id;
END;
$function$;
-- ============ 20260706154540_1a63ef43-ded8-4cb8-bc43-fea1056eab58.sql ============
CREATE TABLE IF NOT EXISTS public.integration_settings (
  service text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_settings TO authenticated;
GRANT SELECT ON public.integration_settings TO anon;
GRANT ALL ON public.integration_settings TO service_role;

ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integration_settings public read"
  ON public.integration_settings FOR SELECT
  USING (true);

CREATE POLICY "integration_settings admin insert"
  ON public.integration_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "integration_settings admin update"
  ON public.integration_settings FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "integration_settings admin delete"
  ON public.integration_settings FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

INSERT INTO public.integration_settings (service, enabled, config) VALUES
  ('firebase', false, '{}'::jsonb),
  ('smtp', false, '{}'::jsonb),
  ('custom', false, '{}'::jsonb)
ON CONFLICT (service) DO NOTHING;
-- ============ 20260706170044_e2e3f490-e048-47b5-b436-1ab9c29894cb.sql ============
-- 6-digit numeric public user code
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_code text;

CREATE OR REPLACE FUNCTION public.gen_user_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _code text;
BEGIN
  LOOP
    _code := lpad((floor(random()*1000000))::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_code = _code);
  END LOOP;
  RETURN _code;
END;
$$;

-- Backfill existing profiles one at a time so each sees prior assignments
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE user_code IS NULL LOOP
    UPDATE public.profiles SET user_code = public.gen_user_code() WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_code_key ON public.profiles (user_code);

-- Assign a code to every new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar, user_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    public.gen_user_code()
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Private / locked rooms with a PIN
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS pin text;

CREATE OR REPLACE FUNCTION public.verify_room_pin(_room_id uuid, _pin text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms
    WHERE id = _room_id AND (is_locked = false OR pin = _pin)
  );
$$;
-- ============ 20260706171541_874ade16-8152-4607-9d44-151c3a005eb7.sql ============
UPDATE public.profiles SET user_code = 'admin', updated_at = now() WHERE id = 'ce6497be-01a1-4bd9-95bf-39b8bb127a30';
-- ============ 20260706183302_83c2bd02-ccfb-45a4-8ce0-fbcc32d0994f.sql ============
-- Ensure full row data is broadcast on updates/deletes so clients can reconcile
ALTER TABLE public.room_messages REPLICA IDENTITY FULL;
ALTER TABLE public.room_participants REPLICA IDENTITY FULL;
ALTER TABLE public.gift_events REPLICA IDENTITY FULL;
ALTER TABLE public.rooms REPLICA IDENTITY FULL;

-- Add tables to the realtime publication (guard against duplicates)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gift_events;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
-- ============ 20260706184806_0b09b230-19db-4534-90c7-e17fe273a8f1.sql ============
-- Seat / on-stage request system for voice & video rooms.
-- Everyone joins as a "viewer" (view/listen only). To speak (voice seat) or
-- share camera (video), a member must request and the host/moderator approves.

ALTER TABLE public.room_participants
  ADD COLUMN IF NOT EXISTS seat_status text NOT NULL DEFAULT 'viewer';

-- Constrain to the three valid states.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'room_participants_seat_status_chk'
  ) THEN
    ALTER TABLE public.room_participants
      ADD CONSTRAINT room_participants_seat_status_chk
      CHECK (seat_status IN ('viewer', 'requested', 'speaker'));
  END IF;
END $$;

-- Existing hosts should already be on stage.
UPDATE public.room_participants rp
  SET seat_status = 'speaker'
  FROM public.rooms r
  WHERE r.id = rp.room_id AND r.host_id = rp.user_id;

-- A member asks to join the stage (take a seat / go on camera).
CREATE OR REPLACE FUNCTION public.room_request_seat(_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  UPDATE public.room_participants
    SET seat_status = 'requested', updated_at = now()
    WHERE room_id = _room_id AND user_id = _uid AND seat_status = 'viewer';
END;
$$;

-- A member cancels their request or steps down from the stage.
CREATE OR REPLACE FUNCTION public.room_leave_seat(_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _host uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT host_id INTO _host FROM public.rooms WHERE id = _room_id;
  IF _uid = _host THEN RAISE EXCEPTION 'The host stays on stage'; END IF;
  UPDATE public.room_participants
    SET seat_status = 'viewer', updated_at = now()
    WHERE room_id = _room_id AND user_id = _uid;
END;
$$;

-- Host / moderator approves, rejects, or removes a member from the stage.
CREATE OR REPLACE FUNCTION public.room_manage_seat(_room_id uuid, _user_id uuid, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _host uuid; _is_mod boolean;
BEGIN
  IF _status NOT IN ('viewer', 'speaker') THEN
    RAISE EXCEPTION 'Invalid seat status';
  END IF;
  SELECT host_id INTO _host FROM public.rooms WHERE id = _room_id;
  IF _host IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;
  SELECT is_moderator INTO _is_mod FROM public.room_participants
    WHERE room_id = _room_id AND user_id = auth.uid();
  IF auth.uid() <> _host AND COALESCE(_is_mod, false) = false THEN
    RAISE EXCEPTION 'Only the host or a moderator can manage the stage';
  END IF;
  IF _user_id = _host THEN RAISE EXCEPTION 'The host is always on stage'; END IF;
  UPDATE public.room_participants
    SET seat_status = _status, updated_at = now()
    WHERE room_id = _room_id AND user_id = _user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.room_request_seat(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.room_leave_seat(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.room_manage_seat(uuid, uuid, text) TO authenticated;
-- ============ 20260706192633_fb7d4048-a35d-40cc-82e7-a988dbc99e01.sql ============
CREATE OR REPLACE FUNCTION public.ensure_room_host_participant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _username text;
  _avatar text;
BEGIN
  SELECT username, avatar INTO _username, _avatar
    FROM public.profiles
    WHERE id = NEW.host_id;

  INSERT INTO public.room_participants (
    room_id,
    user_id,
    username,
    avatar,
    seat_status
  )
  VALUES (
    NEW.id,
    NEW.host_id,
    COALESCE(_username, 'Host'),
    _avatar,
    'speaker'
  )
  ON CONFLICT (room_id, user_id)
  DO UPDATE SET
    username = EXCLUDED.username,
    avatar = EXCLUDED.avatar,
    seat_status = 'speaker',
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_room_host_participant_after_insert ON public.rooms;
CREATE TRIGGER ensure_room_host_participant_after_insert
  AFTER INSERT ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_room_host_participant();

CREATE OR REPLACE FUNCTION public.guard_room_participant_protected_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
  _host uuid;
  _actor_is_mod boolean := false;
BEGIN
  IF current_user IN ('postgres', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Sign in first';
  END IF;

  SELECT host_id INTO _host FROM public.rooms WHERE id = NEW.room_id;
  SELECT COALESCE(is_moderator, false) INTO _actor_is_mod
    FROM public.room_participants
    WHERE room_id = NEW.room_id AND user_id = _actor;

  IF _actor = _host OR COALESCE(_actor_is_mod, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id <> _actor THEN
    RAISE EXCEPTION 'You can only update your own room presence';
  END IF;

  IF NEW.is_moderator IS DISTINCT FROM OLD.is_moderator
     OR NEW.points IS DISTINCT FROM OLD.points
     OR NEW.seat_status IS DISTINCT FROM OLD.seat_status THEN
    RAISE EXCEPTION 'Only the host or a moderator can change stage permissions';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_room_participant_protected_fields_before_update ON public.room_participants;
CREATE TRIGGER guard_room_participant_protected_fields_before_update
  BEFORE UPDATE ON public.room_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_room_participant_protected_fields();

INSERT INTO public.room_participants (room_id, user_id, username, avatar, seat_status)
SELECT r.id, r.host_id, COALESCE(p.username, 'Host'), p.avatar, 'speaker'
FROM public.rooms r
LEFT JOIN public.profiles p ON p.id = r.host_id
WHERE r.is_live = true
ON CONFLICT (room_id, user_id)
DO UPDATE SET
  username = EXCLUDED.username,
  avatar = EXCLUDED.avatar,
  seat_status = 'speaker',
  updated_at = now();
-- ============ 20260706192710_78507957-4101-4ef6-8eab-9195b19361ce.sql ============
CREATE OR REPLACE FUNCTION public.guard_room_participant_insert_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _host uuid;
BEGIN
  SELECT host_id INTO _host FROM public.rooms WHERE id = NEW.room_id;

  IF NEW.user_id = _host THEN
    NEW.seat_status := 'speaker';
  ELSE
    NEW.seat_status := 'viewer';
    NEW.is_moderator := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_room_participant_insert_defaults_before_insert ON public.room_participants;
CREATE TRIGGER guard_room_participant_insert_defaults_before_insert
  BEFORE INSERT ON public.room_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_room_participant_insert_defaults();

REVOKE EXECUTE ON FUNCTION public.ensure_room_host_participant() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_room_participant_protected_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_room_participant_insert_defaults() FROM PUBLIC, anon, authenticated;
-- ============ 20260706202609_dd132dbd-0cc0-4185-8c8d-76b4af54340e.sql ============
CREATE OR REPLACE FUNCTION public.room_end(_room_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _host uuid;
BEGIN
  SELECT host_id INTO _host FROM public.rooms WHERE id = _room_id;
  IF _host IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF auth.uid() <> _host THEN RAISE EXCEPTION 'Only the host can end the room'; END IF;

  UPDATE public.rooms
    SET is_live = false, ended_at = now(), viewers = 0
    WHERE id = _room_id;

  -- Terminate the session for everyone in the room.
  DELETE FROM public.room_participants WHERE room_id = _room_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.room_end(uuid) TO authenticated;
-- ============ 20260706203034_b7c30370-91c5-4386-a64c-a72214fe30ed.sql ============
CREATE OR REPLACE FUNCTION public.leaderboard(_kind text, _period text)
 RETURNS TABLE(user_id uuid, username text, avatar text, points bigint, is_vip boolean, level integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH span AS (
    SELECT CASE _period
      WHEN 'weekly' THEN now() - interval '7 days'
      WHEN 'monthly' THEN now() - interval '30 days'
      ELSE '-infinity'::timestamptz
    END AS since
  ),
  agg AS (
    SELECT
      CASE WHEN _kind = 'gifters' THEN ge.sender_id ELSE r.host_id END AS uid,
      SUM(ge.coins)::bigint AS pts
    FROM public.gift_events ge
    LEFT JOIN public.rooms r ON r.id = ge.room_id
    CROSS JOIN span
    WHERE ge.created_at >= span.since
    GROUP BY 1
  )
  SELECT a.uid, p.username, p.avatar, a.pts, p.is_vip, p.level
  FROM agg a
  JOIN public.profiles p ON p.id = a.uid
  WHERE a.uid IS NOT NULL AND a.pts > 0
  ORDER BY a.pts DESC
  LIMIT 30;
$function$;

GRANT EXECUTE ON FUNCTION public.leaderboard(text, text) TO anon, authenticated;
-- ============ 20260706205121_e2fa2ff9-5895-4a1a-a265-5083e1766407.sql ============
-- Allow everyone to view display pictures (avatars are public content).
-- Previously only the owner could read their own avatar, which broke DPs
-- everywhere else in the app (rooms, chat, leaderboard, inbox, etc.).
CREATE POLICY "Anyone can view avatars"
  ON storage.objects
  FOR SELECT
  TO authenticated, anon
  USING (bucket_id = 'avatars');