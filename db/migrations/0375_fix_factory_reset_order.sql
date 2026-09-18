-- 0375_fix_factory_reset_order.sql
-- Fix reset failures caused by deleting parent gift/room rows before their
-- dependent event/member rows. Keeps the existing admin/production safeguards.

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
  _uid uuid := auth.uid();
  _protected uuid[];
  _res jsonb := '{}'::jsonb;
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

  SELECT COALESCE(array_agg(DISTINCT user_id), '{}')
    INTO _protected
  FROM public.user_roles
  WHERE role IN ('admin', 'moderator');

  IF _mode IN ('finance', 'full') THEN
    UPDATE public.profiles
       SET coins = 0, diamonds = 0, total_gifted_coins = 0
     WHERE NOT (id = ANY(_protected));

    DELETE FROM public.wallet_transactions WHERE NOT (user_id = ANY(_protected));
    DELETE FROM public.recharge_orders WHERE NOT (user_id = ANY(_protected));
    DELETE FROM public.recharge_requests WHERE NOT (user_id = ANY(_protected));
    DELETE FROM public.withdrawal_requests WHERE NOT (user_id = ANY(_protected));

    _res := _res || jsonb_build_object('finance', true);
  END IF;

  IF _mode IN ('user', 'full') THEN
    UPDATE public.profiles
       SET level = 1, xp = 0, vip_level = 0, vip_tier = NULL, vip_title = NULL,
           is_vip = false, vip_expiry = NULL
     WHERE NOT (id = ANY(_protected));

    -- Children first: these can reference gift_sends.
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

    IF to_regclass('public.milestone_gift_sends') IS NOT NULL THEN
      DELETE FROM public.milestone_gift_sends;
    END IF;

    DELETE FROM public.gift_sends;

    _res := _res || jsonb_build_object('user', true);
  END IF;

  IF _mode = 'full' THEN
    -- Room children first, then membership/participant rows.
    DELETE FROM public.room_messages;
    DELETE FROM public.seat_requests;
    DELETE FROM public.seat_invites;
    DELETE FROM public.room_bans;
    DELETE FROM public.room_entrances;
    DELETE FROM public.room_top_frames;
    DELETE FROM public.user_presence;
    DELETE FROM public.room_participants;
    DELETE FROM public.room_members;

    UPDATE public.live_rooms
       SET status = 'ended',
           ended_at = COALESCE(ended_at, now()),
           viewer_count = 0,
           active_pk_match_id = NULL,
           pk_battle = false
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
