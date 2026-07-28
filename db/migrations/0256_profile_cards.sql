-- 0256_profile_cards.sql
-- Premium Profile Card System: catalog, ownership, RPCs, seed.
-- Every user can equip one profile card at a time. When viewers open
-- the user's profile, the card's animated background renders behind
-- the existing hero content.

BEGIN;

-- =====================================================================
-- 1. Catalog
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.profile_cards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key             text UNIQUE NOT NULL,
  name            text NOT NULL,
  description     text,
  category        text NOT NULL,
  rarity          text NOT NULL DEFAULT 'common'
                    CHECK (rarity IN ('common','rare','epic','legendary','mythic')),
  bg_media_url    text NOT NULL,
  bg_media_type   text NOT NULL DEFAULT 'builtin'
                    CHECK (bg_media_type IN ('builtin','image','mp4','webm','lottie','svga')),
  bg_chromakey    text NOT NULL DEFAULT 'none'
                    CHECK (bg_chromakey IN ('none','green','black','luma')),
  thumbnail_url   text,
  frame_effect    text NOT NULL DEFAULT 'gold'
                    CHECK (frame_effect IN ('gold','neon','diamond','aurora','none')),
  accent_color    text NOT NULL DEFAULT '#ffd76a',
  glow_color      text NOT NULL DEFAULT '#a855f7',
  particle_style  text NOT NULL DEFAULT 'sparkles'
                    CHECK (particle_style IN ('none','sparkles','embers','petals','snow','stars','bubbles')),
  price_coins     bigint NOT NULL DEFAULT 0,
  price_diamonds  bigint NOT NULL DEFAULT 0,
  min_vip_level   integer NOT NULL DEFAULT 0,
  duration_days   integer, -- NULL = permanent
  is_active       boolean NOT NULL DEFAULT true,
  is_limited      boolean NOT NULL DEFAULT false,
  starts_at       timestamptz,
  ends_at         timestamptz,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_cards_active   ON public.profile_cards(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_profile_cards_category ON public.profile_cards(category);

GRANT SELECT ON public.profile_cards TO anon, authenticated;
GRANT ALL    ON public.profile_cards TO service_role;

ALTER TABLE public.profile_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_cards_read_active" ON public.profile_cards;
CREATE POLICY "profile_cards_read_active" ON public.profile_cards
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "profile_cards_admin_all" ON public.profile_cards;
CREATE POLICY "profile_cards_admin_all" ON public.profile_cards
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================================
-- 2. Ownership
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.user_profile_cards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id      uuid NOT NULL REFERENCES public.profile_cards(id) ON DELETE CASCADE,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz,
  is_equipped  boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_upc_user ON public.user_profile_cards(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_equipped_profile_card
  ON public.user_profile_cards(user_id) WHERE is_equipped = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profile_cards TO authenticated;
GRANT SELECT ON public.user_profile_cards TO anon;
GRANT ALL ON public.user_profile_cards TO service_role;

ALTER TABLE public.user_profile_cards ENABLE ROW LEVEL SECURITY;

-- Anyone can read ownership rows so viewers can render another user's equipped card.
DROP POLICY IF EXISTS "upc_public_read" ON public.user_profile_cards;
CREATE POLICY "upc_public_read" ON public.user_profile_cards
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "upc_owner_update" ON public.user_profile_cards;
CREATE POLICY "upc_owner_update" ON public.user_profile_cards
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Insert/delete happens through SECURITY DEFINER RPCs below.

-- =====================================================================
-- 3. Purchase log (admin analytics)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.profile_card_purchases (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id        uuid NOT NULL REFERENCES public.profile_cards(id) ON DELETE CASCADE,
  currency       text NOT NULL CHECK (currency IN ('coins','diamonds')),
  amount         bigint NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pcp_card ON public.profile_card_purchases(card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcp_user ON public.profile_card_purchases(user_id, created_at DESC);

GRANT SELECT ON public.profile_card_purchases TO authenticated;
GRANT ALL    ON public.profile_card_purchases TO service_role;
ALTER TABLE public.profile_card_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pcp_owner_or_admin_read" ON public.profile_card_purchases;
CREATE POLICY "pcp_owner_or_admin_read" ON public.profile_card_purchases
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =====================================================================
-- 4. RPCs
-- =====================================================================

CREATE OR REPLACE FUNCTION public.purchase_profile_card(_card_id uuid, _currency text DEFAULT 'coins')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _c record;
  _bal bigint;
  _user_level int;
  _price bigint;
  _expires timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _currency NOT IN ('coins','diamonds') THEN RAISE EXCEPTION 'INVALID_CURRENCY'; END IF;

  SELECT * INTO _c FROM public.profile_cards WHERE id = _card_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'CARD_NOT_FOUND'; END IF;

  IF _c.is_limited AND _c.ends_at IS NOT NULL AND now() > _c.ends_at THEN
    RAISE EXCEPTION 'CARD_EXPIRED';
  END IF;

  SELECT COALESCE(vip_level, 0) INTO _user_level FROM public.profiles WHERE id = _uid;
  IF _user_level < _c.min_vip_level THEN
    RAISE EXCEPTION 'VIP_LEVEL_REQUIRED:%', _c.min_vip_level;
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_profile_cards WHERE user_id = _uid AND card_id = _card_id
             AND (expires_at IS NULL OR expires_at > now())) THEN
    RAISE EXCEPTION 'ALREADY_OWNED';
  END IF;

  _price := CASE WHEN _currency = 'diamonds' THEN _c.price_diamonds ELSE _c.price_coins END;
  IF _price < 0 THEN RAISE EXCEPTION 'INVALID_PRICE'; END IF;

  IF _price > 0 THEN
    IF _currency = 'diamonds' THEN
      UPDATE public.wallets SET diamonds = diamonds - _price, updated_at = now()
        WHERE user_id = _uid AND diamonds >= _price RETURNING diamonds INTO _bal;
      IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_DIAMONDS'; END IF;
      INSERT INTO public.wallet_transactions (user_id, kind, amount, currency, meta)
      VALUES (_uid, 'profile_card_purchase', -_price, 'diamonds',
              jsonb_build_object('card_id', _c.id, 'key', _c.key));
    ELSE
      UPDATE public.wallets SET coins = coins - _price, updated_at = now()
        WHERE user_id = _uid AND coins >= _price RETURNING coins INTO _bal;
      IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_COINS'; END IF;
      INSERT INTO public.wallet_transactions (user_id, kind, amount, currency, meta)
      VALUES (_uid, 'profile_card_purchase', -_price, 'coins',
              jsonb_build_object('card_id', _c.id, 'key', _c.key));
    END IF;
  END IF;

  IF _c.duration_days IS NOT NULL AND _c.duration_days > 0 THEN
    _expires := now() + (_c.duration_days || ' days')::interval;
  ELSE
    _expires := NULL;
  END IF;

  INSERT INTO public.user_profile_cards (user_id, card_id, expires_at)
  VALUES (_uid, _card_id, _expires)
  ON CONFLICT (user_id, card_id) DO UPDATE
    SET expires_at = CASE
      WHEN public.user_profile_cards.expires_at IS NULL THEN NULL
      WHEN excluded.expires_at IS NULL THEN NULL
      ELSE greatest(public.user_profile_cards.expires_at, now()) + (_c.duration_days || ' days')::interval
    END,
        purchased_at = now();

  INSERT INTO public.profile_card_purchases (user_id, card_id, currency, amount)
  VALUES (_uid, _card_id, _currency, _price);

  RETURN jsonb_build_object('ok', true, 'balance', COALESCE(_bal, 0));
END $$;

REVOKE ALL ON FUNCTION public.purchase_profile_card(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.purchase_profile_card(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.equip_profile_card(_card_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  IF _card_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_profile_cards
                   WHERE user_id = _uid AND card_id = _card_id
                   AND (expires_at IS NULL OR expires_at > now())) THEN
      RAISE EXCEPTION 'NOT_OWNED';
    END IF;
  END IF;

  UPDATE public.user_profile_cards SET is_equipped = false
    WHERE user_id = _uid AND is_equipped = true;

  IF _card_id IS NOT NULL THEN
    UPDATE public.user_profile_cards SET is_equipped = true
      WHERE user_id = _uid AND card_id = _card_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.equip_profile_card(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.equip_profile_card(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.unequip_profile_card()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  UPDATE public.user_profile_cards SET is_equipped = false
    WHERE user_id = _uid AND is_equipped = true;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.unequip_profile_card() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.unequip_profile_card() TO authenticated;

-- Admin upsert
CREATE OR REPLACE FUNCTION public.admin_upsert_profile_card(_payload jsonb)
RETURNS public.profile_cards LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.profile_cards;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  IF (_payload->>'id') IS NOT NULL THEN
    UPDATE public.profile_cards SET
      key            = COALESCE(_payload->>'key', key),
      name           = COALESCE(_payload->>'name', name),
      description    = _payload->>'description',
      category       = COALESCE(_payload->>'category', category),
      rarity         = COALESCE(_payload->>'rarity', rarity),
      bg_media_url   = COALESCE(_payload->>'bg_media_url', bg_media_url),
      bg_media_type  = COALESCE(_payload->>'bg_media_type', bg_media_type),
      bg_chromakey   = COALESCE(_payload->>'bg_chromakey', bg_chromakey),
      thumbnail_url  = _payload->>'thumbnail_url',
      frame_effect   = COALESCE(_payload->>'frame_effect', frame_effect),
      accent_color   = COALESCE(_payload->>'accent_color', accent_color),
      glow_color     = COALESCE(_payload->>'glow_color', glow_color),
      particle_style = COALESCE(_payload->>'particle_style', particle_style),
      price_coins    = COALESCE((_payload->>'price_coins')::bigint, price_coins),
      price_diamonds = COALESCE((_payload->>'price_diamonds')::bigint, price_diamonds),
      min_vip_level  = COALESCE((_payload->>'min_vip_level')::int, min_vip_level),
      duration_days  = CASE WHEN _payload ? 'duration_days' THEN NULLIF(_payload->>'duration_days','')::int ELSE duration_days END,
      is_active      = COALESCE((_payload->>'is_active')::boolean, is_active),
      is_limited     = COALESCE((_payload->>'is_limited')::boolean, is_limited),
      starts_at      = CASE WHEN _payload ? 'starts_at' THEN NULLIF(_payload->>'starts_at','')::timestamptz ELSE starts_at END,
      ends_at        = CASE WHEN _payload ? 'ends_at' THEN NULLIF(_payload->>'ends_at','')::timestamptz ELSE ends_at END,
      sort_order     = COALESCE((_payload->>'sort_order')::int, sort_order),
      updated_at     = now()
    WHERE id = (_payload->>'id')::uuid
    RETURNING * INTO _row;
  ELSE
    INSERT INTO public.profile_cards
      (key, name, description, category, rarity, bg_media_url, bg_media_type, bg_chromakey,
       thumbnail_url, frame_effect, accent_color, glow_color, particle_style,
       price_coins, price_diamonds, min_vip_level, duration_days, is_active, is_limited,
       starts_at, ends_at, sort_order)
    VALUES
      (_payload->>'key', _payload->>'name', _payload->>'description', _payload->>'category',
       COALESCE(_payload->>'rarity','common'),
       _payload->>'bg_media_url', COALESCE(_payload->>'bg_media_type','builtin'),
       COALESCE(_payload->>'bg_chromakey','none'),
       _payload->>'thumbnail_url',
       COALESCE(_payload->>'frame_effect','gold'),
       COALESCE(_payload->>'accent_color','#ffd76a'),
       COALESCE(_payload->>'glow_color','#a855f7'),
       COALESCE(_payload->>'particle_style','sparkles'),
       COALESCE((_payload->>'price_coins')::bigint,0),
       COALESCE((_payload->>'price_diamonds')::bigint,0),
       COALESCE((_payload->>'min_vip_level')::int,0),
       NULLIF(_payload->>'duration_days','')::int,
       COALESCE((_payload->>'is_active')::boolean,true),
       COALESCE((_payload->>'is_limited')::boolean,false),
       NULLIF(_payload->>'starts_at','')::timestamptz,
       NULLIF(_payload->>'ends_at','')::timestamptz,
       COALESCE((_payload->>'sort_order')::int,0))
    RETURNING * INTO _row;
  END IF;
  RETURN _row;
END $$;
REVOKE ALL ON FUNCTION public.admin_upsert_profile_card(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_profile_card(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_profile_card(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  DELETE FROM public.profile_cards WHERE id = _id;
END $$;
REVOKE ALL ON FUNCTION public.admin_delete_profile_card(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_profile_card(uuid) TO authenticated;

-- =====================================================================
-- 5. Seed ~45 built-in cards across all categories
-- =====================================================================
INSERT INTO public.profile_cards
  (key, name, description, category, rarity, bg_media_url, bg_media_type, thumbnail_url,
   frame_effect, accent_color, glow_color, particle_style,
   price_coins, price_diamonds, min_vip_level, duration_days, sort_order)
VALUES
  -- Basic
  ('pc_classic',     'Classic',    'Timeless clean look',        'Basic',  'common',    'builtin:classic',    'builtin', NULL, 'gold',    '#e5e7eb','#a1a1aa','sparkles',   500,   0, 0, NULL, 10),
  ('pc_elegant',     'Elegant',    'Refined pearl accents',      'Basic',  'common',    'builtin:elegant',    'builtin', NULL, 'gold',    '#f9d7a1','#c084fc','sparkles',   800,   0, 0, NULL, 11),
  ('pc_dark',        'Dark Mode',  'Pure obsidian gloss',        'Basic',  'common',    'builtin:dark',       'builtin', NULL, 'neon',    '#22d3ee','#0ea5e9','none',       800,   0, 0, NULL, 12),
  ('pc_minimal',     'Minimal',    'Whisper-quiet minimalism',   'Basic',  'common',    'builtin:minimal',    'builtin', NULL, 'none',    '#94a3b8','#64748b','none',       500,   0, 0, NULL, 13),
  -- VIP
  ('pc_vip_gold',    'VIP Gold',      'Molten gold aura',        'VIP',    'rare',      'builtin:vip_gold',    'builtin', NULL, 'gold',    '#ffd76a','#f59e0b','sparkles',  3000,   0, 3, NULL, 20),
  ('pc_vip_plat',    'VIP Platinum',  'Cool platinum sheen',     'VIP',    'rare',      'builtin:vip_plat',    'builtin', NULL, 'gold',    '#e5e7eb','#94a3b8','sparkles',  5000,   0, 5, NULL, 21),
  ('pc_vip_diamond', 'VIP Diamond',   'Refracted diamond light', 'VIP',    'epic',      'builtin:vip_diamond', 'builtin', NULL, 'diamond', '#a5f3fc','#22d3ee','sparkles', 10000,   0, 7, NULL, 22),
  ('pc_vip_black',   'VIP Black',     'Exclusive onyx card',     'VIP',    'legendary', 'builtin:vip_black',   'builtin', NULL, 'gold',    '#ffd76a','#000000','embers',  20000,   0, 9, NULL, 23),
  -- Royal
  ('pc_king',        'King',        'Crown-jewel royal red',    'Royal',  'epic',      'builtin:king',        'builtin', NULL, 'gold',    '#fca5a5','#b91c1c','embers',   8000,   0, 4, NULL, 30),
  ('pc_queen',       'Queen',       'Regal violet velvet',      'Royal',  'epic',      'builtin:queen',       'builtin', NULL, 'gold',    '#f0abfc','#a21caf','sparkles', 8000,   0, 4, NULL, 31),
  ('pc_emperor',     'Emperor',     'Imperial gold throne',     'Royal',  'legendary', 'builtin:emperor',     'builtin', NULL, 'gold',    '#ffd76a','#7c2d12','embers', 15000,   0, 6, NULL, 32),
  ('pc_empress',     'Empress',     'Rose-crown grandeur',      'Royal',  'legendary', 'builtin:empress',     'builtin', NULL, 'gold',    '#fbcfe8','#9d174d','petals', 15000,   0, 6, NULL, 33),
  ('pc_royal_palace','Royal Palace','Palatial marble columns',  'Royal',  'mythic',    'builtin:royal_palace','builtin', NULL, 'gold',    '#ffd76a','#7c3aed','sparkles',25000,   0, 8, NULL, 34),
  -- Luxury
  ('pc_lux_gold',    'Luxury Gold',    'Pure liquid gold',      'Luxury', 'epic',      'builtin:lux_gold',    'builtin', NULL, 'gold',    '#ffd76a','#f59e0b','sparkles', 7000,   0, 3, NULL, 40),
  ('pc_lux_bg',      'Black Gold',     'Onyx meets gold leaf',  'Luxury', 'epic',      'builtin:lux_bg',      'builtin', NULL, 'gold',    '#ffd76a','#111827','sparkles', 9000,   0, 4, NULL, 41),
  ('pc_lux_rose',    'Rose Gold',      'Warm rose gold shine',  'Luxury', 'rare',      'builtin:lux_rose',    'builtin', NULL, 'gold',    '#f9a8d4','#be185d','petals',   6000,   0, 2, NULL, 42),
  ('pc_lux_crystal', 'Crystal Diamond','Cut crystal reflections','Luxury','legendary', 'builtin:lux_crystal', 'builtin', NULL, 'diamond', '#a5f3fc','#0ea5e9','sparkles',14000,   0, 6, NULL, 43),
  ('pc_lux_plat',    'Platinum Shine', 'Icy platinum polish',   'Luxury', 'epic',      'builtin:lux_plat',    'builtin', NULL, 'diamond', '#e2e8f0','#64748b','sparkles', 9000,   0, 4, NULL, 44),
  -- Fantasy
  ('pc_dragon',      'Dragon',   'Fire-scale dragon lair',     'Fantasy','legendary', 'builtin:dragon',      'builtin', NULL, 'gold',    '#f97316','#7c2d12','embers',  12000,   0, 5, NULL, 50),
  ('pc_phoenix',     'Phoenix',  'Reborn in golden flames',    'Fantasy','legendary', 'builtin:phoenix',     'builtin', NULL, 'gold',    '#fbbf24','#dc2626','embers',  12000,   0, 5, NULL, 51),
  ('pc_angel',       'Angel',    'Heavenly white radiance',    'Fantasy','epic',      'builtin:angel',       'builtin', NULL, 'aurora',  '#fef3c7','#f0abfc','sparkles', 9000,   0, 4, NULL, 52),
  ('pc_demon',       'Demon',    'Crimson netherworld',        'Fantasy','epic',      'builtin:demon',       'builtin', NULL, 'neon',    '#ef4444','#7f1d1d','embers',   9000,   0, 4, NULL, 53),
  ('pc_unicorn',     'Unicorn',  'Rainbow mythical shimmer',   'Fantasy','rare',      'builtin:unicorn',     'builtin', NULL, 'aurora',  '#f0abfc','#22d3ee','sparkles', 6000,   0, 2, NULL, 54),
  -- Galaxy
  ('pc_galaxy',      'Galaxy',        'Milky Way spiral',      'Galaxy','epic',      'builtin:galaxy',      'builtin', NULL, 'neon',    '#a78bfa','#3b82f6','stars',    8000,   0, 3, NULL, 60),
  ('pc_nebula',      'Nebula',        'Cosmic nebula drift',   'Galaxy','epic',      'builtin:nebula',      'builtin', NULL, 'neon',    '#f0abfc','#7c3aed','stars',    9000,   0, 4, NULL, 61),
  ('pc_portal',      'Space Portal',  'Wormhole event horizon','Galaxy','legendary', 'builtin:portal',      'builtin', NULL, 'neon',    '#22d3ee','#7c3aed','stars',   13000,   0, 6, NULL, 62),
  ('pc_cosmic',      'Cosmic Energy', 'Pure cosmic waves',     'Galaxy','epic',      'builtin:cosmic',      'builtin', NULL, 'aurora',  '#22d3ee','#f0abfc','sparkles', 9000,   0, 4, NULL, 63),
  ('pc_blackhole',   'Black Hole',    'Gravitational lensing', 'Galaxy','mythic',    'builtin:blackhole',   'builtin', NULL, 'neon',    '#f59e0b','#000000','stars',   25000,   0, 8, NULL, 64),
  -- Nature
  ('pc_sakura',      'Sakura',       'Falling cherry petals',  'Nature','rare',      'builtin:sakura',      'builtin', NULL, 'gold',    '#fbcfe8','#ec4899','petals',   5000,   0, 1, NULL, 70),
  ('pc_ocean',       'Ocean',        'Deep ocean bioluminescence','Nature','rare',   'builtin:ocean',       'builtin', NULL, 'neon',    '#67e8f9','#0369a1','bubbles',  5000,   0, 1, NULL, 71),
  ('pc_forest',      'Forest',       'Enchanted forest glade', 'Nature','rare',      'builtin:forest',      'builtin', NULL, 'aurora',  '#86efac','#166534','sparkles', 5000,   0, 1, NULL, 72),
  ('pc_ice',         'Ice Kingdom',  'Frozen crystal kingdom', 'Nature','epic',      'builtin:ice',         'builtin', NULL, 'diamond', '#bae6fd','#0369a1','snow',     7000,   0, 3, NULL, 73),
  ('pc_fire',        'Fire World',   'Volcanic magma world',   'Nature','epic',      'builtin:fire',        'builtin', NULL, 'gold',    '#fbbf24','#b91c1c','embers',   7000,   0, 3, NULL, 74),
  -- Neon
  ('pc_neon_blue',   'Neon Blue',    'Electric neon blue grid','Neon',  'rare',      'builtin:neon_blue',   'builtin', NULL, 'neon',    '#38bdf8','#1e40af','sparkles', 5000,   0, 2, NULL, 80),
  ('pc_neon_purple', 'Neon Purple',  'Pulsing neon violet',    'Neon',  'rare',      'builtin:neon_purple', 'builtin', NULL, 'neon',    '#c084fc','#7c3aed','sparkles', 5000,   0, 2, NULL, 81),
  ('pc_cyberpunk',   'Cyberpunk',    'Neon rain city',         'Neon',  'epic',      'builtin:cyberpunk',   'builtin', NULL, 'neon',    '#f0abfc','#22d3ee','sparkles', 8000,   0, 4, NULL, 82),
  ('pc_future_city', 'Future City',  'Skyline of tomorrow',    'Neon',  'epic',      'builtin:future_city', 'builtin', NULL, 'neon',    '#22d3ee','#a78bfa','stars',    8000,   0, 4, NULL, 83),
  ('pc_matrix',      'Digital Matrix','Cascading code rain',   'Neon',  'legendary', 'builtin:matrix',      'builtin', NULL, 'neon',    '#22c55e','#052e16','none',    12000,   0, 5, NULL, 84),
  -- Event
  ('pc_ramadan',     'Ramadan',        'Crescent moon & lanterns','Event','epic',   'builtin:ramadan',     'builtin', NULL, 'gold',    '#ffd76a','#7c2d12','sparkles', 4000,   0, 0, NULL, 90),
  ('pc_eid',         'Eid Mubarak',    'Festive gold celebration','Event','epic',   'builtin:eid',         'builtin', NULL, 'gold',    '#ffd76a','#166534','sparkles', 4000,   0, 0, NULL, 91),
  ('pc_independence','Independence',   'National pride banner', 'Event', 'rare',    'builtin:independence','builtin', NULL, 'gold',    '#22c55e','#166534','sparkles', 3000,   0, 0, NULL, 92),
  ('pc_halloween',   'Halloween',      'Spooky pumpkin night',  'Event', 'rare',    'builtin:halloween',   'builtin', NULL, 'neon',    '#f97316','#7c2d12','embers',   3500,   0, 0, NULL, 93),
  ('pc_christmas',   'Christmas',      'Snowy holiday cheer',   'Event', 'rare',    'builtin:christmas',   'builtin', NULL, 'gold',    '#ef4444','#166534','snow',     3500,   0, 0, NULL, 94),
  ('pc_new_year',    'New Year',       'Midnight fireworks',    'Event', 'epic',    'builtin:new_year',    'builtin', NULL, 'gold',    '#ffd76a','#7c3aed','sparkles', 4500,   0, 0, NULL, 95),
  ('pc_valentine',   'Valentine''s Day','Love in the air',      'Event', 'rare',    'builtin:valentine',   'builtin', NULL, 'gold',    '#f472b6','#be185d','petals',   3500,   0, 0, NULL, 96)
ON CONFLICT (key) DO NOTHING;

COMMIT;
