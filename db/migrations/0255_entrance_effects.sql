-- 0255_entrance_effects.sql
-- Room Entrance Animation System: catalog, ownership, purchase log, RPCs, seed.

BEGIN;

-- ==================================================================
-- 1. Catalog
-- ==================================================================
CREATE TABLE IF NOT EXISTS public.entrance_effects (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key            text UNIQUE NOT NULL,
  name           text NOT NULL,
  description    text,
  category       text NOT NULL,
  media_url      text NOT NULL,
  media_type     text NOT NULL CHECK (media_type IN ('mp4','webm','lottie','svga','svg')),
  thumbnail_url  text,
  sound_url      text,
  chromakey      text NOT NULL DEFAULT 'none' CHECK (chromakey IN ('none','green','black','luma')),
  duration_ms    integer NOT NULL DEFAULT 2500,
  price_coins    bigint NOT NULL DEFAULT 0,
  min_vip_level  integer NOT NULL DEFAULT 0,
  is_active      boolean NOT NULL DEFAULT true,
  is_limited     boolean NOT NULL DEFAULT false,
  starts_at      timestamptz,
  ends_at        timestamptz,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entrance_effects_active ON public.entrance_effects(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_entrance_effects_category ON public.entrance_effects(category);

GRANT SELECT ON public.entrance_effects TO anon, authenticated;
GRANT ALL ON public.entrance_effects TO service_role;

ALTER TABLE public.entrance_effects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entrance_effects_read_active" ON public.entrance_effects;
CREATE POLICY "entrance_effects_read_active" ON public.entrance_effects
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "entrance_effects_admin_all" ON public.entrance_effects;
CREATE POLICY "entrance_effects_admin_all" ON public.entrance_effects
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ==================================================================
-- 2. Ownership
-- ==================================================================
CREATE TABLE IF NOT EXISTS public.user_entrance_effects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  effect_id    uuid NOT NULL REFERENCES public.entrance_effects(id) ON DELETE CASCADE,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz,
  is_equipped  boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, effect_id)
);

CREATE INDEX IF NOT EXISTS idx_user_entrance_effects_user ON public.user_entrance_effects(user_id);
-- Only one equipped effect per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_equipped_entrance
  ON public.user_entrance_effects(user_id) WHERE is_equipped = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_entrance_effects TO authenticated;
GRANT ALL ON public.user_entrance_effects TO service_role;

ALTER TABLE public.user_entrance_effects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uee_owner_read" ON public.user_entrance_effects;
CREATE POLICY "uee_owner_read" ON public.user_entrance_effects
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "uee_owner_update" ON public.user_entrance_effects;
CREATE POLICY "uee_owner_update" ON public.user_entrance_effects
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- (Insert/delete happens through SECURITY DEFINER RPCs below.)

-- ==================================================================
-- 3. Purchase log (for admin stats)
-- ==================================================================
CREATE TABLE IF NOT EXISTS public.entrance_purchases (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  effect_id    uuid NOT NULL REFERENCES public.entrance_effects(id) ON DELETE CASCADE,
  price_coins  bigint NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_entrance_purchases_effect ON public.entrance_purchases(effect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entrance_purchases_user ON public.entrance_purchases(user_id, created_at DESC);

GRANT SELECT ON public.entrance_purchases TO authenticated;
GRANT ALL ON public.entrance_purchases TO service_role;

ALTER TABLE public.entrance_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ep_owner_or_admin" ON public.entrance_purchases;
CREATE POLICY "ep_owner_or_admin" ON public.entrance_purchases
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ==================================================================
-- 4. Room entrance broadcast table (viewers subscribe to this)
-- ==================================================================
CREATE TABLE IF NOT EXISTS public.room_entrances (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       uuid NOT NULL,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  effect_id     uuid REFERENCES public.entrance_effects(id) ON DELETE SET NULL,
  effect_key    text,
  media_url     text,
  media_type    text,
  chromakey     text,
  sound_url     text,
  duration_ms   integer,
  username      text,
  avatar_url    text,
  vip_level     integer,
  country       text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_room_entrances_room ON public.room_entrances(room_id, created_at DESC);

GRANT SELECT ON public.room_entrances TO anon, authenticated;
GRANT ALL ON public.room_entrances TO service_role;

ALTER TABLE public.room_entrances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_entrances_read" ON public.room_entrances;
CREATE POLICY "room_entrances_read" ON public.room_entrances
  FOR SELECT TO anon, authenticated USING (true);

-- Realtime
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='room_entrances';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.room_entrances';
  END IF;
END $$;

-- ==================================================================
-- 5. RPCs
-- ==================================================================

-- Purchase an entrance effect (atomic wallet debit)
CREATE OR REPLACE FUNCTION public.purchase_entrance_effect(_effect_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _eff record;
  _bal bigint;
  _user_level int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT * INTO _eff FROM public.entrance_effects WHERE id = _effect_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'EFFECT_NOT_FOUND'; END IF;

  IF _eff.is_limited AND _eff.ends_at IS NOT NULL AND now() > _eff.ends_at THEN
    RAISE EXCEPTION 'EFFECT_EXPIRED';
  END IF;

  -- VIP gate
  SELECT COALESCE(vip_level, 0) INTO _user_level FROM public.profiles WHERE id = _uid;
  IF _user_level < _eff.min_vip_level THEN
    RAISE EXCEPTION 'VIP_LEVEL_REQUIRED:%', _eff.min_vip_level;
  END IF;

  -- Already owned?
  IF EXISTS (SELECT 1 FROM public.user_entrance_effects WHERE user_id = _uid AND effect_id = _effect_id) THEN
    RAISE EXCEPTION 'ALREADY_OWNED';
  END IF;

  IF _eff.price_coins > 0 THEN
    UPDATE public.wallets
       SET coins = coins - _eff.price_coins,
           updated_at = now()
     WHERE user_id = _uid AND coins >= _eff.price_coins
     RETURNING coins INTO _bal;

    IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_COINS'; END IF;

    INSERT INTO public.wallet_transactions (user_id, kind, amount, currency, meta)
    VALUES (_uid, 'entrance_purchase', -_eff.price_coins, 'coins',
            jsonb_build_object('effect_id', _eff.id, 'key', _eff.key));
  END IF;

  INSERT INTO public.user_entrance_effects (user_id, effect_id, expires_at)
  VALUES (_uid, _effect_id, CASE WHEN _eff.is_limited THEN _eff.ends_at ELSE NULL END);

  INSERT INTO public.entrance_purchases (user_id, effect_id, price_coins)
  VALUES (_uid, _effect_id, _eff.price_coins);

  RETURN jsonb_build_object('ok', true, 'balance', COALESCE(_bal, 0));
END $$;

REVOKE ALL ON FUNCTION public.purchase_entrance_effect(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.purchase_entrance_effect(uuid) TO authenticated;

-- Equip
CREATE OR REPLACE FUNCTION public.equip_entrance_effect(_effect_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_entrance_effects WHERE user_id = _uid AND effect_id = _effect_id) THEN
    RAISE EXCEPTION 'NOT_OWNED';
  END IF;
  UPDATE public.user_entrance_effects SET is_equipped = false WHERE user_id = _uid AND is_equipped = true;
  UPDATE public.user_entrance_effects SET is_equipped = true WHERE user_id = _uid AND effect_id = _effect_id;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.equip_entrance_effect(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.equip_entrance_effect(uuid) TO authenticated;

-- Unequip
CREATE OR REPLACE FUNCTION public.unequip_entrance_effect()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  UPDATE public.user_entrance_effects SET is_equipped = false WHERE user_id = _uid AND is_equipped = true;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.unequip_entrance_effect() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.unequip_entrance_effect() TO authenticated;

-- Fire an entrance for a room. Idempotent within 20s per (room, user).
CREATE OR REPLACE FUNCTION public.fire_room_entrance(_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _eff record;
  _prof record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  -- Debounce: no more than one entrance per user/room within 20s.
  IF EXISTS (
    SELECT 1 FROM public.room_entrances
     WHERE room_id = _room_id AND user_id = _uid
       AND created_at > now() - interval '20 seconds'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'debounce');
  END IF;

  SELECT e.* INTO _eff
    FROM public.user_entrance_effects u
    JOIN public.entrance_effects e ON e.id = u.effect_id
   WHERE u.user_id = _uid AND u.is_equipped = true AND e.is_active = true
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'no_effect');
  END IF;

  SELECT username, avatar_url, vip_level, country INTO _prof
    FROM public.profiles WHERE id = _uid;

  INSERT INTO public.room_entrances
    (room_id, user_id, effect_id, effect_key, media_url, media_type, chromakey,
     sound_url, duration_ms, username, avatar_url, vip_level, country)
  VALUES
    (_room_id, _uid, _eff.id, _eff.key, _eff.media_url, _eff.media_type, _eff.chromakey,
     _eff.sound_url, _eff.duration_ms, _prof.username, _prof.avatar_url,
     COALESCE(_prof.vip_level, 0), _prof.country);

  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.fire_room_entrance(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fire_room_entrance(uuid) TO authenticated;

-- Admin upsert
CREATE OR REPLACE FUNCTION public.admin_upsert_entrance_effect(
  _id uuid,
  _key text,
  _name text,
  _description text,
  _category text,
  _media_url text,
  _media_type text,
  _thumbnail_url text,
  _sound_url text,
  _chromakey text,
  _duration_ms integer,
  _price_coins bigint,
  _min_vip_level integer,
  _is_active boolean,
  _is_limited boolean,
  _starts_at timestamptz,
  _ends_at timestamptz,
  _sort_order integer
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _out uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.entrance_effects
      (key, name, description, category, media_url, media_type, thumbnail_url, sound_url,
       chromakey, duration_ms, price_coins, min_vip_level, is_active, is_limited,
       starts_at, ends_at, sort_order)
    VALUES
      (_key, _name, _description, _category, _media_url, _media_type, _thumbnail_url, _sound_url,
       COALESCE(_chromakey,'none'), COALESCE(_duration_ms,2500), COALESCE(_price_coins,0),
       COALESCE(_min_vip_level,0), COALESCE(_is_active,true), COALESCE(_is_limited,false),
       _starts_at, _ends_at, COALESCE(_sort_order,0))
    RETURNING id INTO _out;
  ELSE
    UPDATE public.entrance_effects SET
      key=_key, name=_name, description=_description, category=_category,
      media_url=_media_url, media_type=_media_type, thumbnail_url=_thumbnail_url,
      sound_url=_sound_url, chromakey=COALESCE(_chromakey,'none'),
      duration_ms=COALESCE(_duration_ms,2500), price_coins=COALESCE(_price_coins,0),
      min_vip_level=COALESCE(_min_vip_level,0), is_active=COALESCE(_is_active,true),
      is_limited=COALESCE(_is_limited,false), starts_at=_starts_at, ends_at=_ends_at,
      sort_order=COALESCE(_sort_order,0), updated_at=now()
    WHERE id=_id
    RETURNING id INTO _out;
  END IF;
  RETURN _out;
END $$;
REVOKE ALL ON FUNCTION public.admin_upsert_entrance_effect(uuid,text,text,text,text,text,text,text,text,text,integer,bigint,integer,boolean,boolean,timestamptz,timestamptz,integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_entrance_effect(uuid,text,text,text,text,text,text,text,text,text,integer,bigint,integer,boolean,boolean,timestamptz,timestamptz,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_entrance_effect(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  DELETE FROM public.entrance_effects WHERE id = _id;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.admin_delete_entrance_effect(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_entrance_effect(uuid) TO authenticated;

-- ==================================================================
-- 6. Seed 20 built-in effects (SVG-based, work day one)
-- ==================================================================
INSERT INTO public.entrance_effects
  (key, name, description, category, media_url, media_type, thumbnail_url,
   chromakey, duration_ms, price_coins, min_vip_level, sort_order)
VALUES
  ('vip_gate',        'VIP Entrance',           'Classic golden gate opening for VIP arrivals.',           'VIP',       'builtin:vip_gate',        'svg',  NULL, 'none', 2600,  5000,  1, 10),
  ('royal_arrival',   'Royal Arrival',          'Rolling red carpet with laurel wreaths.',                 'Royal',     'builtin:royal_arrival',   'svg',  NULL, 'none', 2800, 12000,  2, 20),
  ('king_throne',     'King Throne',            'Golden throne descends from the sky.',                    'King',      'builtin:king_throne',     'svg',  NULL, 'none', 3000, 20000,  3, 30),
  ('queen_diadem',    'Queen Diadem',           'Diamond diadem crown reveal.',                            'Queen',     'builtin:queen_diadem',    'svg',  NULL, 'none', 2800, 18000,  3, 40),
  ('diamond_burst',   'Diamond Explosion',      'Prismatic shards burst outward.',                         'Diamond',   'builtin:diamond_burst',   'svg',  NULL, 'none', 2500, 25000,  4, 50),
  ('galaxy_warp',     'Galaxy Warp Jump',       'Warp tunnel of stars and nebulas.',                       'Galaxy',    'builtin:galaxy_warp',     'svg',  NULL, 'none', 2800, 22000,  4, 60),
  ('flying_dragon',   'Flying Dragon',          'Serpent dragon spirals across the screen.',               'Dragon',    'builtin:flying_dragon',   'svg',  NULL, 'none', 3000, 30000,  5, 70),
  ('phoenix_rebirth', 'Phoenix Rebirth',        'Flaming phoenix rises from ashes.',                       'Phoenix',   'builtin:phoenix_rebirth', 'svg',  NULL, 'none', 3000, 30000,  5, 80),
  ('angel_descend',   'Angel Descent',          'Feathered wings and holy light beams.',                   'Angel',     'builtin:angel_descend',   'svg',  NULL, 'none', 2800, 15000,  2, 90),
  ('demon_summon',    'Demon Summon',           'Dark pentagram sigil ignites in violet flame.',           'Demon',     'builtin:demon_summon',    'svg',  NULL, 'none', 2800, 15000,  2, 100),
  ('lightning_storm', 'Lightning Storm',        'Crackling bolts strike the entrance.',                    'Lightning', 'builtin:lightning_storm', 'svg',  NULL, 'none', 2400, 10000,  1, 110),
  ('space_portal',    'Space Portal',           'Rippling wormhole opens with cosmic dust.',               'Space',     'builtin:space_portal',    'svg',  NULL, 'none', 2600, 18000,  3, 120),
  ('fire_gate',       'Fire Gate',              'Twin walls of roaring flame part.',                       'Fire',      'builtin:fire_gate',       'svg',  NULL, 'none', 2500, 12000,  2, 130),
  ('ice_shatter',     'Ice Shatter',            'Crystal ice shell cracks and reveals user.',              'Ice',       'builtin:ice_shatter',     'svg',  NULL, 'none', 2500, 12000,  2, 140),
  ('luxury_gold',     'Luxury Gold Gate',       'Ornate gilded doors swing open.',                         'Luxury',    'builtin:luxury_gold',     'svg',  NULL, 'none', 2800, 28000,  4, 150),
  ('neon_cyber',      'Neon Cyber Portal',      'Glitch scanlines and cyan neon grid.',                    'Neon',      'builtin:neon_cyber',      'svg',  NULL, 'none', 2600, 16000,  3, 160),
  ('future_tech',     'Future Tech HUD',        'Holographic HUD assembles around the avatar.',            'FutureTech','builtin:future_tech',     'svg',  NULL, 'none', 2600, 20000,  3, 170),
  ('festival_burst',  'Festival Burst',         'Fireworks and confetti celebration.',                     'Festival',  'builtin:festival_burst',  'svg',  NULL, 'none', 2500,  8000,  1, 180),
  ('romantic_petals', 'Romantic Petals',        'Rose petals drift with soft pink glow.',                  'Romantic',  'builtin:romantic_petals', 'svg',  NULL, 'none', 2600, 10000,  1, 190),
  ('jalwa_exclusive', 'Jalwa Exclusive',        'The founder-tier signature entrance.',                    'Legendary', 'builtin:jalwa_exclusive', 'svg',  NULL, 'none', 3200, 99000,  6, 200)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  media_url = EXCLUDED.media_url,
  media_type = EXCLUDED.media_type,
  duration_ms = EXCLUDED.duration_ms,
  price_coins = EXCLUDED.price_coins,
  min_vip_level = EXCLUDED.min_vip_level,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

COMMIT;
