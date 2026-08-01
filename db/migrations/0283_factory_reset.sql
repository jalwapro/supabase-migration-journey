-- 0283_factory_reset.sql
-- Admin → Developer Tools → Factory Reset (QA/testing only).
-- Wipes testing data while preserving accounts, credentials, official assets
-- and every integration/app setting. Disabled automatically in production mode.

-- ── production mode flag (app_kv) ────────────────────────────────────────────
INSERT INTO public.app_kv(key, value)
VALUES ('production_mode', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ── audit log of every reset attempt (including failed password tries) ───────
CREATE TABLE IF NOT EXISTS public.factory_reset_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  mode        text NOT NULL,
  success     boolean NOT NULL DEFAULT false,
  reason      text,
  ip          text,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.factory_reset_logs TO authenticated;
GRANT ALL ON public.factory_reset_logs TO service_role;
ALTER TABLE public.factory_reset_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read reset logs" ON public.factory_reset_logs;
CREATE POLICY "admins read reset logs" ON public.factory_reset_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_factory_reset_logs_created
  ON public.factory_reset_logs (created_at DESC);

-- ── is production mode on? ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_production_mode()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT value::text = 'true' FROM public.app_kv WHERE key = 'production_mode'), false);
$$;

GRANT EXECUTE ON FUNCTION public.is_production_mode() TO authenticated;

-- ── the reset itself ─────────────────────────────────────────────────────────
-- _mode: 'user' | 'finance' | 'full'
CREATE OR REPLACE FUNCTION public.admin_factory_reset(
  _mode text,
  _password text,
  _ip text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid       uuid := auth.uid();
  _protected uuid[];
  _res       jsonb := '{}'::jsonb;
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF public.is_production_mode() THEN
    INSERT INTO public.factory_reset_logs(admin_id, mode, success, reason, ip)
    VALUES (_uid, _mode, false, 'production mode active', _ip);
    RAISE EXCEPTION 'Factory Reset is disabled in Production Mode';
  END IF;

  IF _password IS DISTINCT FROM 'Tayyabajan1210' THEN
    INSERT INTO public.factory_reset_logs(admin_id, mode, success, reason, ip)
    VALUES (_uid, _mode, false, 'invalid reset password', _ip);
    RAISE EXCEPTION 'Invalid Reset Password';
  END IF;

  IF _mode NOT IN ('user', 'finance', 'full') THEN
    RAISE EXCEPTION 'Unknown reset mode: %', _mode;
  END IF;

  -- accounts that must never be touched
  SELECT COALESCE(array_agg(DISTINCT user_id), '{}') INTO _protected
  FROM public.user_roles WHERE role IN ('admin', 'moderator');

  -- ── FINANCE ────────────────────────────────────────────────────────────────
  IF _mode IN ('finance', 'full') THEN
    UPDATE public.profiles
       SET coins = 0, diamonds = 0, total_gifted_coins = 0
     WHERE NOT (id = ANY(_protected));

    DELETE FROM public.wallet_transactions WHERE NOT (user_id = ANY(_protected));
    DELETE FROM public.recharge_orders    WHERE NOT (user_id = ANY(_protected));
    DELETE FROM public.recharge_requests  WHERE NOT (user_id = ANY(_protected));
    DELETE FROM public.withdrawal_requests WHERE NOT (user_id = ANY(_protected));

    _res := _res || jsonb_build_object('finance', true);
  END IF;

  -- ── USER PROGRESS + STATS ─────────────────────────────────────────────────
  IF _mode IN ('user', 'full') THEN
    UPDATE public.profiles
       SET level = 1, xp = 0, vip_level = 0, vip_tier = NULL, vip_title = NULL,
           is_vip = false, vip_expiry = NULL
     WHERE NOT (id = ANY(_protected));

    DELETE FROM public.gift_sends;
    DELETE FROM public.gift_playback_events;
    DELETE FROM public.gift_events;
    DELETE FROM public.chat_emoji_sends;
    DELETE FROM public.room_popularity;
    DELETE FROM public.room_gift_goals;
    DELETE FROM public.host_love_hearts;
    DELETE FROM public.room_seat_likes;
    DELETE FROM public.milestone_broadcasts;
    DELETE FROM public.profile_views;
    DELETE FROM public.daily_spins;
    DELETE FROM public.vip_level_events;
    DELETE FROM public.vip_rewards_claimed;
    DELETE FROM public.game_rounds;
    DELETE FROM public.pk_battles;
    DELETE FROM public.pk_matches;
    DELETE FROM public.pk_invites;
    DELETE FROM public.pk_match_queue;
    DELETE FROM public.pk_champions;
    DELETE FROM public.notifications;
    DELETE FROM public.user_reports;

    _res := _res || jsonb_build_object('user', true);
  END IF;

  -- ── LIVE DATA (full reset only) ───────────────────────────────────────────
  IF _mode = 'full' THEN
    DELETE FROM public.room_messages;
    DELETE FROM public.room_participants;
    DELETE FROM public.room_members;
    DELETE FROM public.room_entrances;
    DELETE FROM public.room_top_frames;
    DELETE FROM public.seat_requests;
    DELETE FROM public.seat_invites;
    DELETE FROM public.room_bans;
    DELETE FROM public.user_presence;
    UPDATE public.live_rooms
       SET status = 'ended', ended_at = COALESCE(ended_at, now()), viewer_count = 0,
           active_pk_match_id = NULL, pk_battle = false
     WHERE status <> 'ended';

    _res := _res || jsonb_build_object('live', true);
  END IF;

  INSERT INTO public.factory_reset_logs(admin_id, mode, success, reason, ip, details)
  VALUES (_uid, _mode, true, NULL, _ip, _res);

  RETURN _res || jsonb_build_object('ok', true, 'mode', _mode, 'at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.admin_factory_reset(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_factory_reset(text, text, text) TO authenticated;
