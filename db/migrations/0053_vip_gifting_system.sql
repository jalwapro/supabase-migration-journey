-- ============================================================================
-- Jalwa VIP Gifting System — Phase 1
-- Level 0..100 driven exclusively by lifetime gift-coins sent.
-- Anchor thresholds (per user spec):
--   L1=1M, L2=3M, L3=6M, L4=10M, L5=15M, L6=21M, L7=28M, L8=36M, L9=45M, L10=55M
--   L20≈410M, L30≈1.56B, L40≈3.71B, L50≈7.96B, L60≈16B, L70≈31B, L80≈59B,
--   L90≈108B, L100≈190B
-- Between anchors we interpolate in log space -> smooth exponential curve.
-- Never-decrease invariant enforced at the trigger.
-- ============================================================================

-- ----- 1. profiles: VIP columns --------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_level      int    NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_tier       text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_title      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_vip_level ON public.profiles(vip_level DESC);

-- ----- 2. vip_level_config -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vip_level_config (
  level             int  PRIMARY KEY CHECK (level BETWEEN 0 AND 100),
  threshold_coins   bigint NOT NULL,
  tier              text NOT NULL,
  title             text NOT NULL,
  badge_url         text,
  frame_url         text,
  bubble_url        text,
  entrance_url      text,
  name_color        text,
  reward_coins      bigint NOT NULL DEFAULT 0,
  reward_bundle     jsonb  NOT NULL DEFAULT '{}'::jsonb,
  privileges        jsonb  NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vip_level_config TO anon, authenticated;
GRANT ALL    ON public.vip_level_config TO service_role;
ALTER TABLE public.vip_level_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vip_cfg_read ON public.vip_level_config;
CREATE POLICY vip_cfg_read ON public.vip_level_config FOR SELECT USING (true);

-- ----- 3. seed 101 rows via log-linear interpolation -----------------------
DO $$
DECLARE
  anchors int[]   := ARRAY[0,1,2,3,4,5,6,7,8,9,10,20,30,40,50,60,70,80,90,100];
  vals    bigint[] := ARRAY[0,1000000,3000000,6000000,10000000,15000000,21000000,
                            28000000,36000000,45000000,55000000,
                            410000000,1560000000,3710000000,7960000000,
                            16000000000,31000000000,59000000000,108000000000,190000000000];
  tiers   text[]  := ARRAY['Rookie','Bronze VIP','Silver VIP','Gold VIP','Ruby VIP',
                           'Platinum VIP','Diamond VIP','Master VIP','Grandmaster VIP',
                           'Legend VIP','Mythic VIP','Jalwa King'];
  colors  text[]  := ARRAY['#94a3b8','#c2751a','#d8dee7','#f5b638','#ef4444',
                           '#38bdf8','#a855f7','#22d3ee','#fb7185','#eab308','#ec4899','#f43f5e'];
  i int; a int; b int; va double precision; vb double precision; thresh bigint;
  tier_idx int; tier_name text; title_name text; color text;
  reward_coins bigint; reward_bundle jsonb;
BEGIN
  FOR lvl IN 0..100 LOOP
    -- find surrounding anchors
    a := 0; b := 100;
    FOR i IN 1..array_length(anchors,1) LOOP
      IF anchors[i] <= lvl THEN a := anchors[i]; END IF;
    END LOOP;
    FOR i IN reverse array_length(anchors,1)..1 LOOP
      IF anchors[i] >= lvl THEN b := anchors[i]; END IF;
    END LOOP;

    IF a = b THEN
      thresh := vals[array_position(anchors, a)];
    ELSE
      va := ln(GREATEST(vals[array_position(anchors,a)],1));
      vb := ln(GREATEST(vals[array_position(anchors,b)],1));
      thresh := round(exp( va + (vb-va) * ((lvl - a)::double precision / (b - a)) ))::bigint;
    END IF;

    -- tier index
    IF      lvl = 0             THEN tier_idx := 1;
    ELSIF   lvl BETWEEN 1  AND 10  THEN tier_idx := 2;
    ELSIF   lvl BETWEEN 11 AND 20  THEN tier_idx := 3;
    ELSIF   lvl BETWEEN 21 AND 30  THEN tier_idx := 4;
    ELSIF   lvl BETWEEN 31 AND 40  THEN tier_idx := 5;
    ELSIF   lvl BETWEEN 41 AND 50  THEN tier_idx := 6;
    ELSIF   lvl BETWEEN 51 AND 60  THEN tier_idx := 7;
    ELSIF   lvl BETWEEN 61 AND 70  THEN tier_idx := 8;
    ELSIF   lvl BETWEEN 71 AND 80  THEN tier_idx := 9;
    ELSIF   lvl BETWEEN 81 AND 90  THEN tier_idx := 10;
    ELSIF   lvl BETWEEN 91 AND 99  THEN tier_idx := 11;
    ELSE                              tier_idx := 12;
    END IF;
    tier_name  := tiers[tier_idx];
    color      := colors[tier_idx];
    title_name := tier_name || ' Lv' || lvl;

    -- milestone rewards
    reward_coins := CASE lvl
      WHEN 10 THEN 5000 WHEN 20 THEN 10000 WHEN 30 THEN 15000
      WHEN 40 THEN 20000 WHEN 50 THEN 30000 WHEN 60 THEN 40000
      WHEN 70 THEN 50000 WHEN 80 THEN 60000 WHEN 90 THEN 80000
      WHEN 100 THEN 100000 ELSE 0
    END;
    reward_bundle := CASE lvl
      WHEN 10  THEN '{"bundle":"Bronze Bundle"}'::jsonb
      WHEN 20  THEN '{"bundle":"Silver Bundle"}'::jsonb
      WHEN 30  THEN '{"bundle":"Gold Bundle"}'::jsonb
      WHEN 40  THEN '{"bundle":"Ruby Bundle"}'::jsonb
      WHEN 50  THEN '{"bundle":"Diamond Bundle"}'::jsonb
      WHEN 60  THEN '{"bundle":"Royal Bundle"}'::jsonb
      WHEN 70  THEN '{"bundle":"Grandmaster Bundle"}'::jsonb
      WHEN 80  THEN '{"bundle":"Legend Bundle"}'::jsonb
      WHEN 90  THEN '{"bundle":"Mythic Bundle"}'::jsonb
      WHEN 100 THEN '{"bundle":"Jalwa King Bundle","extras":["crown","animation","frame","badge"]}'::jsonb
      ELSE '{}'::jsonb
    END;

    INSERT INTO public.vip_level_config
      (level, threshold_coins, tier, title, name_color, reward_coins, reward_bundle, privileges)
    VALUES (lvl, thresh, tier_name, title_name, color, reward_coins, reward_bundle,
            jsonb_build_object(
              'chatPriority', lvl,
              'animatedName', lvl >= 11,
              'exclusiveEmojis', lvl >= 21,
              'priorityRoomEntry', lvl >= 31,
              'prioritySeat', lvl >= 41,
              'profileMusic', lvl >= 51,
              'vipSupport', lvl >= 71,
              'topRoomList', lvl = 100
            ))
    ON CONFLICT (level) DO UPDATE
      SET threshold_coins = EXCLUDED.threshold_coins,
          tier            = EXCLUDED.tier,
          title           = EXCLUDED.title,
          name_color      = EXCLUDED.name_color,
          reward_coins    = EXCLUDED.reward_coins,
          reward_bundle   = EXCLUDED.reward_bundle,
          privileges      = EXCLUDED.privileges,
          updated_at      = now();
  END LOOP;
END $$;

-- ----- 4. rewards claimed --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vip_rewards_claimed (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level      int  NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, level)
);
GRANT SELECT, INSERT ON public.vip_rewards_claimed TO authenticated;
GRANT ALL ON public.vip_rewards_claimed TO service_role;
ALTER TABLE public.vip_rewards_claimed ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vip_rc_self ON public.vip_rewards_claimed;
CREATE POLICY vip_rc_self ON public.vip_rewards_claimed
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ----- 5. level events (for notifications + history) ----------------------
CREATE TABLE IF NOT EXISTS public.vip_level_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_level int  NOT NULL,
  to_level   int  NOT NULL,
  total_coins bigint NOT NULL,
  at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vip_evt_user_at ON public.vip_level_events(user_id, at DESC);
GRANT SELECT ON public.vip_level_events TO authenticated;
GRANT ALL ON public.vip_level_events TO service_role;
ALTER TABLE public.vip_level_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vip_evt_self ON public.vip_level_events;
CREATE POLICY vip_evt_self ON public.vip_level_events
  FOR SELECT USING (auth.uid() = user_id);

-- ----- 6. admin logs -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vip_admin_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   uuid NOT NULL REFERENCES auth.users(id),
  target_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action     text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vip_admin_target ON public.vip_admin_logs(target_id, at DESC);
GRANT SELECT ON public.vip_admin_logs TO authenticated;
GRANT ALL ON public.vip_admin_logs TO service_role;
ALTER TABLE public.vip_admin_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vip_admin_log_read ON public.vip_admin_logs;
CREATE POLICY vip_admin_log_read ON public.vip_admin_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ----- 7. replace trigger to use vip_level_config --------------------------
CREATE OR REPLACE FUNCTION public.tg_gift_sender_level_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_total bigint;
  v_old_level int;
  v_new_level int;
  v_tier      text;
  v_title     text;
  v_next_thresh bigint;
  v_cur_thresh  bigint;
BEGIN
  IF NEW.sender_id IS NULL OR COALESCE(NEW.coins_spent, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles
     SET total_gifted_coins = COALESCE(total_gifted_coins, 0) + NEW.coins_spent
   WHERE id = NEW.sender_id
   RETURNING total_gifted_coins, COALESCE(vip_level,0) INTO v_new_total, v_old_level;

  IF v_new_total IS NULL THEN RETURN NEW; END IF;

  -- compute level from config (largest threshold <= total)
  SELECT level, tier, title, threshold_coins
    INTO v_new_level, v_tier, v_title, v_cur_thresh
    FROM public.vip_level_config
   WHERE threshold_coins <= v_new_total
   ORDER BY level DESC LIMIT 1;

  IF v_new_level IS NULL THEN v_new_level := 0; END IF;
  -- never decrease
  v_new_level := GREATEST(COALESCE(v_old_level,0), v_new_level);

  -- next threshold for xp progress
  SELECT threshold_coins INTO v_next_thresh
    FROM public.vip_level_config WHERE level = v_new_level + 1;

  UPDATE public.profiles
     SET vip_level      = v_new_level,
         vip_tier       = v_tier,
         vip_title      = v_title,
         vip_updated_at = now(),
         level          = v_new_level,
         xp             = CASE
                            WHEN v_next_thresh IS NULL THEN 0
                            ELSE GREATEST(0, LEAST(v_next_thresh - v_cur_thresh, v_new_total - v_cur_thresh))
                          END
   WHERE id = NEW.sender_id;

  IF v_new_level > COALESCE(v_old_level,0) THEN
    INSERT INTO public.vip_level_events(user_id, from_level, to_level, total_coins)
      VALUES (NEW.sender_id, COALESCE(v_old_level,0), v_new_level, v_new_total);

    INSERT INTO public.notifications(user_id, kind, title, body, data)
      VALUES (NEW.sender_id, 'system_broadcast',
              'VIP Level Up! ' || v_title,
              'You reached ' || v_tier || ' (Level ' || v_new_level || ').',
              jsonb_build_object('vip_level', v_new_level, 'tier', v_tier, 'title', v_title));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gift_sender_level_progress ON public.gift_sends;
CREATE TRIGGER trg_gift_sender_level_progress
  AFTER INSERT ON public.gift_sends
  FOR EACH ROW EXECUTE FUNCTION public.tg_gift_sender_level_progress();

-- ----- 8. backfill existing users -----------------------------------------
WITH agg AS (
  SELECT sender_id, SUM(coins_spent)::bigint AS total
    FROM public.gift_sends
   WHERE sender_id IS NOT NULL
   GROUP BY sender_id
),
lvl AS (
  SELECT a.sender_id, a.total,
         (SELECT c.level FROM public.vip_level_config c
           WHERE c.threshold_coins <= a.total
           ORDER BY c.level DESC LIMIT 1) AS new_level
    FROM agg a
),
info AS (
  SELECT l.sender_id, l.total, GREATEST(COALESCE(p.vip_level,0), COALESCE(l.new_level,0)) AS final_level
    FROM lvl l JOIN public.profiles p ON p.id = l.sender_id
)
UPDATE public.profiles p
   SET total_gifted_coins = i.total,
       vip_level  = i.final_level,
       vip_tier   = c.tier,
       vip_title  = c.title,
       level      = i.final_level,
       vip_updated_at = now()
  FROM info i
  JOIN public.vip_level_config c ON c.level = i.final_level
 WHERE p.id = i.sender_id;
