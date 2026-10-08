-- Separate lifetime VIP Level progression from paid VIP membership/subscription.
CREATE TABLE IF NOT EXISTS public.vip_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id uuid REFERENCES public.vip_tiers(id) ON DELETE SET NULL,
  tier_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  price_coins bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vip_subscriptions_user_status ON public.vip_subscriptions(user_id,status,expires_at DESC);
ALTER TABLE public.vip_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vip_subscriptions_self_select ON public.vip_subscriptions;
CREATE POLICY vip_subscriptions_self_select ON public.vip_subscriptions FOR SELECT TO authenticated USING (auth.uid()=user_id);
REVOKE ALL ON public.vip_subscriptions FROM anon;
GRANT SELECT ON public.vip_subscriptions TO authenticated;
GRANT ALL ON public.vip_subscriptions TO service_role;

-- Only migrate records that unambiguously represent an old paid subscription plan.
INSERT INTO public.vip_subscriptions(user_id,tier_id,tier_name,started_at,expires_at,price_coins,status)
SELECT p.id,t.id,t.name,COALESCE(p.vip_expiry-make_interval(days=>t.duration_days),now()),p.vip_expiry,t.price,'active'
FROM public.profiles p JOIN public.vip_tiers t ON lower(t.name)=lower(p.vip_tier)
WHERE COALESCE(p.is_vip,false) AND p.vip_expiry>now()
  AND NOT EXISTS (SELECT 1 FROM public.vip_subscriptions s WHERE s.user_id=p.id AND s.status='active' AND s.expires_at>now());

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_level_tier text;
UPDATE public.profiles p SET vip_level_tier=c.tier FROM public.vip_level_config c WHERE c.level=COALESCE(p.vip_level,0);

-- VIP level is lifetime gift-spend only; it never changes subscription state.
CREATE OR REPLACE FUNCTION public.tg_gift_sender_level_progress()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_new_total bigint; v_old_level int; v_new_level int; v_tier text; v_title text; v_next_thresh bigint; v_cur_thresh bigint;
BEGIN
 IF NEW.sender_id IS NULL OR COALESCE(NEW.coins_spent,0)<=0 THEN RETURN NEW; END IF;
 UPDATE public.profiles SET total_gifted_coins=COALESCE(total_gifted_coins,0)+NEW.coins_spent WHERE id=NEW.sender_id
 RETURNING total_gifted_coins,COALESCE(vip_level,0) INTO v_new_total,v_old_level;
 SELECT level,tier,title,threshold_coins INTO v_new_level,v_tier,v_title,v_cur_thresh FROM public.vip_level_config
 WHERE threshold_coins<=v_new_total ORDER BY level DESC LIMIT 1;
 v_new_level:=GREATEST(COALESCE(v_old_level,0),COALESCE(v_new_level,0));
 SELECT threshold_coins INTO v_next_thresh FROM public.vip_level_config WHERE level=v_new_level+1;
 UPDATE public.profiles SET vip_level=v_new_level,vip_level_tier=v_tier,vip_title=v_title,vip_updated_at=now(),level=v_new_level,
 xp=CASE WHEN v_next_thresh IS NULL THEN 0 ELSE GREATEST(0,LEAST(v_next_thresh-v_cur_thresh,v_new_total-v_cur_thresh)) END WHERE id=NEW.sender_id;
 IF v_new_level>COALESCE(v_old_level,0) THEN
  INSERT INTO public.vip_level_events(user_id,from_level,to_level,total_coins) VALUES(NEW.sender_id,COALESCE(v_old_level,0),v_new_level,v_new_total);
  INSERT INTO public.notifications(user_id,kind,title,body,data) VALUES(NEW.sender_id,'system_broadcast','VIP Level Up! '||v_title,'You reached '||COALESCE(v_tier,'VIP')||' (Level '||v_new_level||').',jsonb_build_object('vip_level',v_new_level,'tier',v_tier,'title',v_title));
 END IF;
 RETURN NEW;
END; $$;

-- Paid subscription purchase is independent from VIP Level.
DROP FUNCTION IF EXISTS public.purchase_vip(uuid);
CREATE OR REPLACE FUNCTION public.purchase_vip(_tier_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); t public.vip_tiers%rowtype; c bigint; old_exp timestamptz; new_exp timestamptz; sid uuid;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
 SELECT * INTO t FROM public.vip_tiers WHERE id=_tier_id AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'VIP subscription plan not found or inactive' USING ERRCODE='P0002'; END IF;
 SELECT coins INTO c FROM public.profiles WHERE id=u FOR UPDATE;
 IF COALESCE(c,0)<t.price THEN RAISE EXCEPTION 'Insufficient coins' USING ERRCODE='P0001'; END IF;
 SELECT max(expires_at) INTO old_exp FROM public.vip_subscriptions WHERE user_id=u AND status='active' AND expires_at>now();
 new_exp:=CASE WHEN old_exp IS NOT NULL THEN old_exp+make_interval(days=>t.duration_days) ELSE now()+make_interval(days=>t.duration_days) END;
 PERFORM set_config('app.trusted_definer','on',true);
 UPDATE public.profiles SET coins=coins-t.price,is_vip=true,vip_expiry=new_exp,vip_tier=t.name,vip_updated_at=now(),updated_at=now() WHERE id=u;
 PERFORM set_config('app.trusted_definer','off',true);
 INSERT INTO public.vip_subscriptions(user_id,tier_id,tier_name,started_at,expires_at,price_coins,status) VALUES(u,t.id,t.name,now(),new_exp,t.price,'active') RETURNING id INTO sid;
 UPDATE public.vip_subscriptions SET status=CASE WHEN expires_at>now() THEN 'active' ELSE 'expired' END,updated_at=now() WHERE user_id=u AND id<>sid AND status='active';
 INSERT INTO public.wallet_transactions(user_id,kind,coins,coins_delta,ref_type,ref_id,note,balance_coins_after) VALUES(u,'vip_subscription_purchase',-t.price,-t.price,'vip_subscription',t.id,'VIP Subscription: '||t.name||' ('||t.duration_days||'d)',c-t.price);
 RETURN jsonb_build_object('ok',true,'subscription_id',sid,'subscription_tier',t.name,'coins_after',c-t.price,'expires_at',new_exp);
END; $$;
REVOKE ALL ON FUNCTION public.purchase_vip(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.purchase_vip(uuid) TO authenticated;

COMMENT ON TABLE public.vip_subscriptions IS 'Paid VIP membership subscriptions. Separate from lifetime gift-based VIP Level.';
COMMENT ON COLUMN public.profiles.vip_level IS 'Lifetime gift-spend VIP level; never subscription duration.';
COMMENT ON COLUMN public.profiles.vip_level_tier IS 'Lifetime gift-spend level tier label.';
