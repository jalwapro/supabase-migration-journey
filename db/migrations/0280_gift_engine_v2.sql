-- Gift Engine v2 — richer gift asset metadata + playback telemetry + gift goals.

-- ============ Phase 2: gift asset columns ============
ALTER TABLE public.gifts
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS thumb_url text,
  ADD COLUMN IF NOT EXISTS preview_url text,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loop boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audio_volume numeric(3,2) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS audio_enabled boolean NOT NULL DEFAULT true;

-- Backfill from the legacy single-purpose columns.
UPDATE public.gifts SET audio_url = sound_url WHERE audio_url IS NULL AND sound_url IS NOT NULL;
UPDATE public.gifts SET thumb_url = COALESCE(icon_path, image_url) WHERE thumb_url IS NULL;
UPDATE public.gifts SET preview_url = clip_path WHERE preview_url IS NULL AND clip_path IS NOT NULL;
-- Higher-priced gifts pre-empt cheaper ones by default.
UPDATE public.gifts SET priority = LEAST(100, GREATEST(0, (price / 1000)::int)) WHERE priority = 0;

ALTER TABLE public.gifts
  DROP CONSTRAINT IF EXISTS gifts_audio_volume_check;
ALTER TABLE public.gifts
  ADD CONSTRAINT gifts_audio_volume_check CHECK (audio_volume >= 0 AND audio_volume <= 1);

CREATE INDEX IF NOT EXISTS gifts_priority_idx ON public.gifts (priority DESC) WHERE is_active;

-- Keep audio_url and legacy sound_url in sync both ways.
CREATE OR REPLACE FUNCTION public._sync_gift_audio()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.audio_url IS DISTINCT FROM OLD.audio_url OR TG_OP = 'INSERT' THEN
    NEW.sound_url := COALESCE(NEW.audio_url, NEW.sound_url);
  END IF;
  IF NEW.sound_url IS NOT NULL AND NEW.audio_url IS NULL THEN
    NEW.audio_url := NEW.sound_url;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gifts_audio_sync ON public.gifts;
CREATE TRIGGER trg_gifts_audio_sync
  BEFORE INSERT OR UPDATE ON public.gifts
  FOR EACH ROW EXECUTE FUNCTION public._sync_gift_audio();

-- ============ Phase 4: playback telemetry ============
CREATE TABLE IF NOT EXISTS public.gift_playback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid,
  gift_id uuid REFERENCES public.gifts(id) ON DELETE SET NULL,
  user_id uuid,
  event_key text,
  status text NOT NULL CHECK (status IN ('delivered','played','failed','skipped')),
  queue_wait_ms integer,
  playback_ms integer,
  fetch_ms integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gift_playback_events_created_idx
  ON public.gift_playback_events (created_at DESC);
CREATE INDEX IF NOT EXISTS gift_playback_events_gift_idx
  ON public.gift_playback_events (gift_id, created_at DESC);
CREATE INDEX IF NOT EXISTS gift_playback_events_status_idx
  ON public.gift_playback_events (status, created_at DESC);

GRANT SELECT, INSERT ON public.gift_playback_events TO authenticated;
GRANT ALL ON public.gift_playback_events TO service_role;
ALTER TABLE public.gift_playback_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own telemetry insert" ON public.gift_playback_events;
CREATE POLICY "own telemetry insert" ON public.gift_playback_events
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admins read telemetry" ON public.gift_playback_events;
CREATE POLICY "admins read telemetry" ON public.gift_playback_events
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- ============ Phase 6: gift goals ============
CREATE TABLE IF NOT EXISTS public.room_gift_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL UNIQUE,
  target_coins bigint NOT NULL DEFAULT 10000 CHECK (target_coins > 0),
  current_coins bigint NOT NULL DEFAULT 0 CHECK (current_coins >= 0),
  reward_gift_id uuid REFERENCES public.gifts(id) ON DELETE SET NULL,
  celebration text NOT NULL DEFAULT 'confetti'
    CHECK (celebration IN ('confetti','fireworks','flash','none')),
  repeat_goal boolean NOT NULL DEFAULT true,
  cooldown_seconds integer NOT NULL DEFAULT 60 CHECK (cooldown_seconds >= 0),
  completions integer NOT NULL DEFAULT 0,
  last_completed_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS room_gift_goals_room_idx ON public.room_gift_goals (room_id);

GRANT SELECT ON public.room_gift_goals TO anon;
GRANT SELECT, INSERT, UPDATE ON public.room_gift_goals TO authenticated;
GRANT ALL ON public.room_gift_goals TO service_role;
ALTER TABLE public.room_gift_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "goals readable" ON public.room_gift_goals;
CREATE POLICY "goals readable" ON public.room_gift_goals FOR SELECT USING (true);

DROP POLICY IF EXISTS "host or admin manages goal" ON public.room_gift_goals;
CREATE POLICY "host or admin manages goal" ON public.room_gift_goals
  FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.live_rooms r WHERE r.id = room_id AND r.host_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.live_rooms r WHERE r.id = room_id AND r.host_id = auth.uid())
  );

-- Global defaults an admin controls from the panel.
CREATE TABLE IF NOT EXISTS public.gift_goal_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT true,
  default_target_coins bigint NOT NULL DEFAULT 10000 CHECK (default_target_coins > 0),
  default_reward_gift_id uuid REFERENCES public.gifts(id) ON DELETE SET NULL,
  default_celebration text NOT NULL DEFAULT 'confetti'
    CHECK (default_celebration IN ('confetti','fireworks','flash','none')),
  default_repeat boolean NOT NULL DEFAULT true,
  default_cooldown_seconds integer NOT NULL DEFAULT 60,
  reward_audio_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.gift_goal_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.gift_goal_settings TO anon, authenticated;
GRANT ALL ON public.gift_goal_settings TO service_role;
ALTER TABLE public.gift_goal_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings readable" ON public.gift_goal_settings;
CREATE POLICY "settings readable" ON public.gift_goal_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "admins manage goal settings" ON public.gift_goal_settings;
CREATE POLICY "admins manage goal settings" ON public.gift_goal_settings
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Advance a room's gift goal atomically; returns the new state and whether it
-- just completed (so exactly one client triggers the reward broadcast).
CREATE OR REPLACE FUNCTION public.bump_room_gift_goal(_room_id uuid, _coins bigint)
RETURNS TABLE (
  current_coins bigint,
  target_coins bigint,
  percent integer,
  completed boolean,
  reward_gift_id uuid,
  celebration text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g public.room_gift_goals%ROWTYPE;
  s public.gift_goal_settings%ROWTYPE;
  did_complete boolean := false;
BEGIN
  SELECT * INTO s FROM public.gift_goal_settings WHERE id;
  IF s IS NULL OR NOT s.enabled THEN
    RETURN;
  END IF;

  INSERT INTO public.room_gift_goals (room_id, target_coins, reward_gift_id, celebration, repeat_goal, cooldown_seconds)
  VALUES (_room_id, s.default_target_coins, s.default_reward_gift_id, s.default_celebration, s.default_repeat, s.default_cooldown_seconds)
  ON CONFLICT (room_id) DO NOTHING;

  SELECT * INTO g FROM public.room_gift_goals WHERE room_id = _room_id FOR UPDATE;
  IF g IS NULL OR NOT g.is_active THEN
    RETURN;
  END IF;

  UPDATE public.room_gift_goals
     SET current_coins = g.current_coins + GREATEST(0, COALESCE(_coins, 0)),
         updated_at = now()
   WHERE room_id = _room_id
  RETURNING * INTO g;

  IF g.current_coins >= g.target_coins
     AND (g.last_completed_at IS NULL OR now() - g.last_completed_at > make_interval(secs => g.cooldown_seconds))
  THEN
    did_complete := true;
    UPDATE public.room_gift_goals
       SET current_coins = CASE WHEN g.repeat_goal THEN GREATEST(0, g.current_coins - g.target_coins) ELSE g.target_coins END,
           completions = g.completions + 1,
           is_active = g.repeat_goal,
           last_completed_at = now(),
           updated_at = now()
     WHERE room_id = _room_id
    RETURNING * INTO g;
  END IF;

  RETURN QUERY SELECT
    g.current_coins,
    g.target_coins,
    LEAST(100, GREATEST(0, ((g.current_coins::numeric / g.target_coins) * 100)::int)),
    did_complete,
    g.reward_gift_id,
    g.celebration;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_room_gift_goal(uuid, bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.bump_room_gift_goal(uuid, bigint) TO authenticated, service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.room_gift_goals;
