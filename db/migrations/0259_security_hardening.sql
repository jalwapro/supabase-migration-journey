-- 0259_security_hardening.sql
-- Audit fixes:
--   1. Lock down the internal _migrations ledger (was writable by any logged-in user).
--   2. Server-side ownership enforcement for cosmetic equip (frame/ring/bubble/car/
--      entrance/data_card/theme) — previously a direct client UPDATE, so any user
--      could equip paid shop items for free via the API.
--   3. Missing foreign-key indexes (cascade + join performance).

-- ---------------------------------------------------------------- 1. _migrations
REVOKE ALL ON TABLE public._migrations FROM authenticated, anon;
ALTER TABLE public._migrations ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public._migrations TO service_role;

-- ------------------------------------------------------- 2. cosmetic ownership
-- Does the caller own (and not have expired) this shop item?
CREATE OR REPLACE FUNCTION public.user_owns_theme(_user_id uuid, _theme_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.themes t
    WHERE t.id = _theme_id
      AND t.is_active
      AND (
        t.is_free
        OR (t.price = 0 AND t.price_diamonds = 0)
        OR EXISTS (
          SELECT 1 FROM public.user_themes ut
          WHERE ut.user_id = _user_id
            AND ut.theme_id = _theme_id
            AND (ut.expires_at IS NULL OR ut.expires_at > now())
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_owns_theme(uuid, uuid) TO authenticated;

-- Equip a purchased cosmetic. The client may only name an item id; the column and
-- the asset URL are resolved server-side, so nothing about the equip is trusted.
CREATE OR REPLACE FUNCTION public.equip_cosmetic(_theme_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  slug text;
  col  text;
  url  text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_owns_theme(uid, _theme_id) THEN
    RAISE EXCEPTION 'You do not own this item';
  END IF;

  SELECT lower(coalesce(c.slug, c.name)),
         coalesce(t.animation_url, t.preview_url, t.bg_image)
    INTO slug, url
    FROM public.themes t
    LEFT JOIN public.theme_categories c ON c.id = t.category_id
   WHERE t.id = _theme_id;

  PERFORM set_config('app.trusted_definer', 'on', true);

  IF slug IS NULL OR slug IN ('theme', 'themes') THEN
    UPDATE public.profiles SET theme_id = _theme_id WHERE id = uid;
    PERFORM set_config('app.trusted_definer', 'off', true);
    RETURN 'theme';
  END IF;

  col := CASE
    WHEN slug IN ('frame', 'frames')                      THEN 'frame'
    WHEN slug IN ('ring', 'rings')                        THEN 'ring'
    WHEN slug IN ('bubble', 'bubbles', 'chat bubble')     THEN 'bubble'
    WHEN slug IN ('car', 'cars', 'vehicle')               THEN 'car'
    WHEN slug IN ('entrance', 'entry', 'entrance effect') THEN 'entrance'
    WHEN slug IN ('data card', 'data_card', 'datacard', 'card') THEN 'data_card'
    WHEN slug IN ('special id', 'special_id', 'specialid') THEN 'special_id'
    ELSE NULL
  END;

  IF col IS NULL THEN
    PERFORM set_config('app.trusted_definer', 'off', true);
    RAISE EXCEPTION 'This category cannot be equipped yet';
  END IF;

  EXECUTE format('UPDATE public.profiles SET %I = $1 WHERE id = $2', col)
    USING url, uid;

  PERFORM set_config('app.trusted_definer', 'off', true);
  RETURN col;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equip_cosmetic(uuid) TO authenticated;

-- Unequip is always safe (clears a slot), but keep it server-side for symmetry.
CREATE OR REPLACE FUNCTION public.unequip_cosmetic(_slot text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  col text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  col := CASE lower(coalesce(_slot, ''))
    WHEN 'frame' THEN 'frame'
    WHEN 'ring' THEN 'ring'
    WHEN 'bubble' THEN 'bubble'
    WHEN 'car' THEN 'car'
    WHEN 'entrance' THEN 'entrance'
    WHEN 'data_card' THEN 'data_card'
    WHEN 'special_id' THEN 'special_id'
    WHEN 'theme' THEN 'theme_id'
    ELSE NULL
  END;
  IF col IS NULL THEN
    RAISE EXCEPTION 'Unknown slot';
  END IF;

  PERFORM set_config('app.trusted_definer', 'on', true);
  EXECUTE format('UPDATE public.profiles SET %I = NULL WHERE id = $1', col) USING uid;
  PERFORM set_config('app.trusted_definer', 'off', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unequip_cosmetic(text) TO authenticated;

-- Guard trigger: non-admin direct UPDATEs may only CLEAR a cosmetic slot.
-- Setting one to a non-null value must go through equip_cosmetic().
CREATE OR REPLACE FUNCTION public.profiles_guard_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trusted text := current_setting('app.trusted_definer', true);
BEGIN
  IF trusted = 'on' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Economy / identity columns are never client-writable.
  NEW.id                 := OLD.id;
  NEW.coins              := OLD.coins;
  NEW.diamonds           := OLD.diamonds;
  NEW.is_vip             := OLD.is_vip;
  NEW.vip_expiry         := OLD.vip_expiry;
  NEW.vip_tier           := OLD.vip_tier;
  NEW.vip_title          := OLD.vip_title;
  NEW.vip_level          := OLD.vip_level;
  NEW.vip_updated_at     := OLD.vip_updated_at;
  NEW.level              := OLD.level;
  NEW.xp                 := OLD.xp;
  NEW.is_free            := OLD.is_free;
  NEW.total_gifted_coins := OLD.total_gifted_coins;
  NEW.status             := OLD.status;
  NEW.user_code          := OLD.user_code;
  NEW.frame_expires_at   := OLD.frame_expires_at;
  NEW.special_id         := OLD.special_id;
  NEW.created_at         := OLD.created_at;

  -- Cosmetic slots: clearing allowed, equipping must be verified server-side.
  IF NEW.frame     IS NOT NULL AND NEW.frame     IS DISTINCT FROM OLD.frame     THEN NEW.frame     := OLD.frame;     END IF;
  IF NEW.ring      IS NOT NULL AND NEW.ring      IS DISTINCT FROM OLD.ring      THEN NEW.ring      := OLD.ring;      END IF;
  IF NEW.bubble    IS NOT NULL AND NEW.bubble    IS DISTINCT FROM OLD.bubble    THEN NEW.bubble    := OLD.bubble;    END IF;
  IF NEW.car       IS NOT NULL AND NEW.car       IS DISTINCT FROM OLD.car       THEN NEW.car       := OLD.car;       END IF;
  IF NEW.entrance  IS NOT NULL AND NEW.entrance  IS DISTINCT FROM OLD.entrance  THEN NEW.entrance  := OLD.entrance;  END IF;
  IF NEW.data_card IS NOT NULL AND NEW.data_card IS DISTINCT FROM OLD.data_card THEN NEW.data_card := OLD.data_card; END IF;
  IF NEW.theme_id  IS NOT NULL AND NEW.theme_id  IS DISTINCT FROM OLD.theme_id
     AND NOT public.user_owns_theme(auth.uid(), NEW.theme_id) THEN
    NEW.theme_id := OLD.theme_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------ 3. missing FK indexes
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users (blocked_id);
CREATE INDEX IF NOT EXISTS idx_chat_emoji_sends_slug ON public.chat_emoji_sends (emoji_slug);
CREATE INDEX IF NOT EXISTS idx_custom_themes_reviewed_by ON public.custom_themes (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_daily_spins_prize ON public.daily_spins (prize_id);
CREATE INDEX IF NOT EXISTS idx_daily_spins_granted_theme ON public.daily_spins (granted_theme_id);
CREATE INDEX IF NOT EXISTS idx_gallery_unlocks_viewer ON public.gallery_unlocks (viewer_id);
CREATE INDEX IF NOT EXISTS idx_game_rounds_game ON public.game_rounds (game_id);
CREATE INDEX IF NOT EXISTS idx_gift_events_room ON public.gift_events (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_events_sender ON public.gift_events (sender_id);
CREATE INDEX IF NOT EXISTS idx_gift_events_gift ON public.gift_events (gift_id);
CREATE INDEX IF NOT EXISTS idx_gift_sends_gift ON public.gift_sends (gift_id);
CREATE INDEX IF NOT EXISTS idx_live_rooms_active_pk ON public.live_rooms (active_pk_match_id);
CREATE INDEX IF NOT EXISTS idx_live_rooms_milestone_gift ON public.live_rooms (milestone_gift_id);
CREATE INDEX IF NOT EXISTS idx_live_rooms_milestone_receiver ON public.live_rooms (milestone_receiver_id);
CREATE INDEX IF NOT EXISTS idx_milestone_broadcasts_host ON public.milestone_broadcasts (host_id);
CREATE INDEX IF NOT EXISTS idx_milestone_broadcasts_room ON public.milestone_broadcasts (room_id);
CREATE INDEX IF NOT EXISTS idx_notifications_actor ON public.notifications (actor_id);
CREATE INDEX IF NOT EXISTS idx_pk_battles_host ON public.pk_battles (host_id);
CREATE INDEX IF NOT EXISTS idx_pk_battles_room ON public.pk_battles (room_id);
CREATE INDEX IF NOT EXISTS idx_pk_champions_approved_by ON public.pk_champions (approved_by);
CREATE INDEX IF NOT EXISTS idx_pk_champions_banner ON public.pk_champions (banner_id);
CREATE INDEX IF NOT EXISTS idx_pk_invites_from_room ON public.pk_invites (from_room);
CREATE INDEX IF NOT EXISTS idx_pk_invites_to_room ON public.pk_invites (to_room);
CREATE INDEX IF NOT EXISTS idx_pk_match_queue_room ON public.pk_match_queue (room_id);
CREATE INDEX IF NOT EXISTS idx_pk_matches_host_a ON public.pk_matches (host_a);
CREATE INDEX IF NOT EXISTS idx_pk_matches_host_b ON public.pk_matches (host_b);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer ON public.profile_views (viewer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_theme ON public.profiles (theme_id);
CREATE INDEX IF NOT EXISTS idx_recharge_orders_package ON public.recharge_orders (package_id);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_package ON public.recharge_requests (package_id);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_reviewed_by ON public.recharge_requests (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_user ON public.recharge_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_bans_banned_by ON public.room_bans (banned_by);
CREATE INDEX IF NOT EXISTS idx_room_bans_user ON public.room_bans (user_id);
CREATE INDEX IF NOT EXISTS idx_room_entrances_effect ON public.room_entrances (effect_id);
CREATE INDEX IF NOT EXISTS idx_room_entrances_user ON public.room_entrances (user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON public.room_members (user_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_user ON public.room_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user ON public.room_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_seat_invites_from_user ON public.seat_invites (from_user);
CREATE INDEX IF NOT EXISTS idx_spotlight_triggers_animation ON public.spotlight_triggers (animation_id);
CREATE INDEX IF NOT EXISTS idx_spotlight_triggers_by ON public.spotlight_triggers (triggered_by);
CREATE INDEX IF NOT EXISTS idx_support_conversations_agent ON public.support_conversations (assigned_agent);
CREATE INDEX IF NOT EXISTS idx_support_messages_sender ON public.support_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_user_entrance_effects_effect ON public.user_entrance_effects (effect_id);
CREATE INDEX IF NOT EXISTS idx_user_frames_frame ON public.user_frames (frame_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_cards_card ON public.user_profile_cards (card_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_reported ON public.user_reports (reported_user_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter ON public.user_reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_user_themes_theme ON public.user_themes (theme_id);
CREATE INDEX IF NOT EXISTS idx_vip_admin_logs_admin ON public.vip_admin_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON public.wallet_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user ON public.withdrawal_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_reviewed_by ON public.withdrawal_requests (reviewed_by);
