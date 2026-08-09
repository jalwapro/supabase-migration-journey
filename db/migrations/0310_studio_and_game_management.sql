-- 0310: Gift/Entrance Studio shared render config + admin-managed room games.
begin;

-- ---------------------------------------------------------------------------
-- 1. Room Entrance Studio — same render_config engine as gifts.
-- ---------------------------------------------------------------------------
ALTER TABLE public.entrance_effects
  ADD COLUMN IF NOT EXISTS render_config jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.room_entrances
  ADD COLUMN IF NOT EXISTS render_config jsonb;

CREATE OR REPLACE FUNCTION public.fire_room_entrance(_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _eff record;
  _prof record;
  _row public.room_entrances;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT * INTO _row
    FROM public.room_entrances
   WHERE room_id = _room_id AND user_id = _uid
     AND created_at > now() - interval '20 seconds'
   ORDER BY created_at DESC
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'debounce', 'event', to_jsonb(_row));
  END IF;

  SELECT e.* INTO _eff
    FROM public.user_entrance_effects u
    JOIN public.entrance_effects e ON e.id = u.effect_id
   WHERE u.user_id = _uid AND u.is_equipped = true AND e.is_active = true
     AND (u.expires_at IS NULL OR u.expires_at > now())
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'no_effect');
  END IF;

  SELECT username, avatar AS avatar_url, vip_level, country INTO _prof
    FROM public.profiles WHERE id = _uid;

  INSERT INTO public.room_entrances
    (room_id, user_id, effect_id, effect_key, media_url, media_type, chromakey,
     sound_url, duration_ms, username, avatar_url, vip_level, country, render_config)
  VALUES
    (_room_id, _uid, _eff.id, _eff.key, _eff.media_url, _eff.media_type, _eff.chromakey,
     _eff.sound_url, _eff.duration_ms, _prof.username, _prof.avatar_url,
     COALESCE(_prof.vip_level, 0), _prof.country, COALESCE(_eff.render_config, '{}'::jsonb))
  RETURNING * INTO _row;

  RETURN jsonb_build_object('ok', true, 'event', to_jsonb(_row));
END $function$;

-- ---------------------------------------------------------------------------
-- 2. Room games — single admin-managed catalogue (native + iframe games).
-- ---------------------------------------------------------------------------
ALTER TABLE public.room_games
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'iframe',
  ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'casino',
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS thumb_url text;

ALTER TABLE public.room_games
  DROP CONSTRAINT IF EXISTS room_games_kind_check;
ALTER TABLE public.room_games
  ADD CONSTRAINT room_games_kind_check CHECK (kind IN ('native', 'iframe'));

ALTER TABLE public.room_games ALTER COLUMN game_url DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_room_games_visible
  ON public.room_games (visible, enabled, sort_order);

-- Native games that already exist in the app code, keyed by slug.
INSERT INTO public.room_games (slug, name, subtitle, kind, category, game_url, enabled, visible, sort_order)
VALUES
  ('ludo',          'Ludo Battle',     '4 seats · live board · room bet',   'native', 'board',  NULL, true, true, 10),
  ('slots777',      '777 Slots',       'Jackpot · free spins',              'native', 'casino', NULL, true, true, 20),
  ('crash_x',       'Crash X',         'Ride the multiplier · cash out',    'native', 'casino', NULL, true, true, 30),
  ('dragon_tiger',  'Dragon vs Tiger', 'Pick a side · instant result',      'native', 'casino', NULL, true, true, 40),
  ('in_out',        'In & Out',        'Roll the dice · pick in or out',    'native', 'casino', NULL, true, true, 50),
  ('plinko',        'Plinko',          'Drop the ball · chase multipliers', 'native', 'casino', NULL, true, true, 60),
  ('under_over_7',  'Under & Over 7',  'Beat the seven',                    'native', 'casino', NULL, true, true, 70),
  ('crash_point',   'Crash Point',     'Cash out before the crash',         'native', 'casino', NULL, true, true, 80),
  ('scratch_card',  'Scratch Card',    'Scratch · instant win',             'native', 'casino', NULL, true, true, 90),
  ('apple_fortune', 'Apple of Fortune','Climb the ladder',                  'native', 'casino', NULL, true, true, 100),
  ('spin_win',      'Spin & Win',      'Spin the golden wheel',             'native', 'casino', NULL, true, true, 110),
  ('vampire_curse', 'Vampire Curse',   'Break the curse · big multipliers', 'native', 'casino', NULL, true, true, 120)
ON CONFLICT (slug) DO UPDATE
  SET kind = 'native',
      name = COALESCE(NULLIF(public.room_games.name, ''), EXCLUDED.name),
      subtitle = COALESCE(public.room_games.subtitle, EXCLUDED.subtitle);

DROP POLICY IF EXISTS "room_games read" ON public.room_games;
CREATE POLICY "room_games read" ON public.room_games
  FOR SELECT USING ((enabled AND visible) OR public.is_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_games TO authenticated;

NOTIFY pgrst, 'reload schema';
commit;
