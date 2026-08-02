-- 0304 Premium Entrance Effects & Profile Frame asset platform
-- Adds: image-based premium DP frames, scheduling, VIP gating, favourites,
-- usage statistics for both entrance effects and frames.

-- ─────────────────────────────────────────── frames: premium asset columns
ALTER TABLE public.dp_frames
  ADD COLUMN IF NOT EXISTS category      text    NOT NULL DEFAULT 'Premium',
  ADD COLUMN IF NOT EXISTS image_url     text,
  ADD COLUMN IF NOT EXISTS media_type    text    NOT NULL DEFAULT 'css',
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS rarity        text    NOT NULL DEFAULT 'premium',
  ADD COLUMN IF NOT EXISTS min_vip_level int     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_level     int     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_limited    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS starts_at     timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at       timestamptz,
  ADD COLUMN IF NOT EXISTS purchase_count bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS equip_count    bigint NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.dp_frames
    ADD CONSTRAINT dp_frames_media_type_check
    CHECK (media_type = ANY (ARRAY['css','png','svg','webp','gif']));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_dp_frames_category ON public.dp_frames (category);
CREATE INDEX IF NOT EXISTS idx_dp_frames_active_sort ON public.dp_frames (is_active, sort);

GRANT SELECT ON public.dp_frames TO anon, authenticated;
GRANT ALL ON public.dp_frames TO service_role;

-- ─────────────────────────────────────────── entrances: stats + landscape
ALTER TABLE public.entrance_effects
  ADD COLUMN IF NOT EXISTS landscape_url  text,
  ADD COLUMN IF NOT EXISTS webm_url       text,
  ADD COLUMN IF NOT EXISTS rarity         text   NOT NULL DEFAULT 'premium',
  ADD COLUMN IF NOT EXISTS purchase_count bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS play_count     bigint NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────── favourites (both asset types)
CREATE TABLE IF NOT EXISTS public.asset_favorites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('entrance','frame')),
  asset_id   uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, asset_type, asset_id)
);
CREATE INDEX IF NOT EXISTS idx_asset_favorites_user ON public.asset_favorites (user_id, asset_type);

GRANT SELECT, INSERT, DELETE ON public.asset_favorites TO authenticated;
GRANT ALL ON public.asset_favorites TO service_role;
ALTER TABLE public.asset_favorites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY asset_favorites_owner_all ON public.asset_favorites
    FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────── usage statistics
CREATE OR REPLACE FUNCTION public.bump_entrance_purchase_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.entrance_effects SET purchase_count = purchase_count + 1 WHERE id = NEW.effect_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bump_entrance_purchase ON public.entrance_purchases;
CREATE TRIGGER trg_bump_entrance_purchase AFTER INSERT ON public.entrance_purchases
  FOR EACH ROW EXECUTE FUNCTION public.bump_entrance_purchase_count();

CREATE OR REPLACE FUNCTION public.bump_entrance_play_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.effect_id IS NOT NULL THEN
    UPDATE public.entrance_effects SET play_count = play_count + 1 WHERE id = NEW.effect_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bump_entrance_play ON public.room_entrances;
CREATE TRIGGER trg_bump_entrance_play AFTER INSERT ON public.room_entrances
  FOR EACH ROW EXECUTE FUNCTION public.bump_entrance_play_count();

CREATE OR REPLACE FUNCTION public.bump_frame_purchase_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.dp_frames SET purchase_count = purchase_count + 1 WHERE id = NEW.frame_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bump_frame_purchase ON public.user_frames;
CREATE TRIGGER trg_bump_frame_purchase AFTER INSERT ON public.user_frames
  FOR EACH ROW EXECUTE FUNCTION public.bump_frame_purchase_count();

-- ─────────────────────────────────────────── purchase_frame: gating rules
CREATE OR REPLACE FUNCTION public.purchase_frame(_frame_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _frame public.dp_frames%ROWTYPE;
  _base timestamptz;
  _expiry timestamptz;
  _vip int;
  _lvl int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in to buy frames'; END IF;
  SELECT * INTO _frame FROM public.dp_frames WHERE id = _frame_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Frame not found'; END IF;

  IF _frame.is_limited THEN
    IF _frame.starts_at IS NOT NULL AND now() < _frame.starts_at THEN
      RAISE EXCEPTION 'This frame is not available yet';
    END IF;
    IF _frame.ends_at IS NOT NULL AND now() > _frame.ends_at THEN
      RAISE EXCEPTION 'This limited frame has expired';
    END IF;
  END IF;

  SELECT COALESCE(vip_level, 0), COALESCE(level, 0) INTO _vip, _lvl
    FROM public.profiles WHERE id = _uid;
  IF _vip < _frame.min_vip_level THEN
    RAISE EXCEPTION 'VIP % required', _frame.min_vip_level;
  END IF;
  IF _lvl < _frame.min_level THEN
    RAISE EXCEPTION 'Level % required', _frame.min_level;
  END IF;

  IF _frame.price > 0 THEN
    UPDATE public.profiles SET coins = coins - _frame.price, updated_at = now()
      WHERE id = _uid AND coins >= _frame.price;
    IF NOT FOUND THEN RAISE EXCEPTION 'Not enough coins'; END IF;
    INSERT INTO public.wallet_transactions (user_id, kind, coins, note)
      VALUES (_uid, 'frame', -_frame.price, 'Bought frame ' || _frame.name);
  END IF;

  SELECT GREATEST(now(), COALESCE(expires_at, now())) INTO _base
    FROM public.user_frames WHERE user_id = _uid AND frame_id = _frame_id;
  IF _base IS NULL THEN _base := now(); END IF;
  _expiry := _base + (_frame.duration_days || ' days')::interval;

  INSERT INTO public.user_frames (user_id, frame_id, expires_at)
    VALUES (_uid, _frame_id, _expiry)
    ON CONFLICT (user_id, frame_id) DO UPDATE SET expires_at = _expiry;

  UPDATE public.dp_frames SET equip_count = equip_count + 1 WHERE id = _frame_id;
  UPDATE public.profiles
    SET frame = _frame_id::text, frame_expires_at = _expiry, updated_at = now()
    WHERE id = _uid;
END $$;

GRANT EXECUTE ON FUNCTION public.purchase_frame(uuid) TO authenticated;

-- ─────────────────────────────────────────── admin stats
CREATE OR REPLACE FUNCTION public.admin_asset_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _out jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT jsonb_build_object(
    'entrances', (SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'purchase_count')::bigint DESC), '[]'::jsonb)
      FROM (SELECT jsonb_build_object('id', id, 'name', name, 'category', category,
                     'purchase_count', purchase_count, 'play_count', play_count,
                     'owners', (SELECT count(*) FROM public.user_entrance_effects u WHERE u.effect_id = e.id),
                     'is_active', is_active) AS x
            FROM public.entrance_effects e) s),
    'frames', (SELECT COALESCE(jsonb_agg(y ORDER BY (y->>'purchase_count')::bigint DESC), '[]'::jsonb)
      FROM (SELECT jsonb_build_object('id', id, 'name', name, 'category', category,
                     'purchase_count', purchase_count, 'equip_count', equip_count,
                     'owners', (SELECT count(*) FROM public.user_frames u WHERE u.frame_id = f.id),
                     'is_active', is_active) AS y
            FROM public.dp_frames f) t)
  ) INTO _out;
  RETURN _out;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_asset_stats() TO authenticated;
