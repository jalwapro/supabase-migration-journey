-- P0/P1: canonical gift leaderboard, voice-room creation and gift economy hardening.

CREATE OR REPLACE FUNCTION public.leaderboard(_kind text, _period text)
RETURNS TABLE(user_id uuid, username text, avatar text, points bigint, is_vip boolean, level integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH bounds AS (
    SELECT CASE lower(trim(coalesce(_period, 'daily')))
      WHEN 'daily' THEN date_trunc('day', now())
      WHEN 'weekly' THEN date_trunc('week', now())
      WHEN 'monthly' THEN date_trunc('month', now())
      ELSE date_trunc('day', now())
    END AS since
  ), agg AS (
    SELECT CASE lower(trim(coalesce(_kind, 'gifters')))
             WHEN 'gifters' THEN gs.sender_id
             WHEN 'receivers' THEN gs.receiver_id
           END AS uid,
           sum(gs.coins_spent)::bigint AS pts
    FROM public.gift_sends gs CROSS JOIN bounds b
    WHERE gs.created_at >= b.since AND gs.created_at <= now() AND gs.coins_spent > 0
    GROUP BY 1
  )
  SELECT a.uid, p.username, p.avatar, a.pts, p.is_vip, p.level
  FROM agg a JOIN public.profiles p ON p.id = a.uid
  WHERE a.uid IS NOT NULL AND a.pts > 0
  ORDER BY a.pts DESC, p.created_at ASC, a.uid
  LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.leaderboard(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leaderboard(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_voice_room(
  _title text DEFAULT NULL, _category_id uuid DEFAULT NULL,
  _is_locked boolean DEFAULT false, _password text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE me uuid := auth.uid(); room_id uuid; channel text; clean_title text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT id INTO room_id FROM public.live_rooms
   WHERE host_id = me AND status = 'live' ORDER BY created_at DESC LIMIT 1;
  IF room_id IS NOT NULL THEN RETURN room_id; END IF;
  clean_title := coalesce(nullif(btrim(_title), ''), 'Voice Room');
  IF length(clean_title) > 120 THEN RAISE EXCEPTION 'room title too long'; END IF;
  IF _is_locked AND nullif(btrim(_password), '') IS NULL THEN RAISE EXCEPTION 'password required for private room'; END IF;
  channel := 'jalwa-' || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.live_rooms
    (host_id,title,room_type,status,rtc_channel,seat_count,viewer_count,pk_battle,is_locked,password,category_id,locked_seats,heartbeat_at,host_last_seen_at,updated_at)
  VALUES
    (me,clean_title,'voice','live',channel,20,0,false,coalesce(_is_locked,false),
     CASE WHEN coalesce(_is_locked,false) THEN nullif(btrim(_password),'') ELSE NULL END,
     _category_id,ARRAY[1]::integer[],now(),now(),now()) RETURNING id INTO room_id;
  INSERT INTO public.room_members(room_id,user_id,seat_index,seated_at)
  VALUES(room_id,me,1,now())
  ON CONFLICT (room_id,user_id) DO UPDATE SET seat_index=1,seated_at=now();
  RETURN room_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_voice_room(text,uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_voice_room(text,uuid,boolean,text) TO authenticated;

-- The application uses send_gift() as the only canonical browser gift RPC.
REVOKE ALL ON FUNCTION public.send_gift_multi(uuid,uuid[],uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_gift_multi_atomic(uuid,uuid,uuid,uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_room_gift(uuid,text,text,integer,text,uuid,uuid) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.send_gift_multi(uuid,uuid[],uuid,integer);
DROP FUNCTION IF EXISTS public.send_gift_multi_atomic(uuid,uuid,uuid,uuid,integer);
DROP FUNCTION IF EXISTS public.send_room_gift(uuid,text,text,integer,text,uuid,uuid);

-- Keep the canonical send_gift atomic and remove the duplicate total_gifted_coins write;
-- trg_gift_sender_level_progress owns that progress update.
CREATE OR REPLACE FUNCTION public.send_gift(
  _room_id uuid, _receiver_id uuid, _gift_id uuid, _quantity integer,
  _write_message boolean DEFAULT true
)
RETURNS public.gift_sends LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sender uuid := auth.uid(); g public.gifts%ROWTYPE; v_row public.gift_sends;
  v_coins bigint; v_diamonds bigint; v_sender_coins bigint;
BEGIN
  IF v_sender IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _quantity IS NULL OR _quantity < 1 OR _quantity > 100 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  IF _room_id IS NULL OR _receiver_id IS NULL OR _gift_id IS NULL THEN RAISE EXCEPTION 'Gift parameters are required'; END IF;
  IF _receiver_id = v_sender THEN RAISE EXCEPTION 'Cannot gift yourself'; END IF;
  SELECT * INTO g FROM public.gifts
   WHERE id=_gift_id AND coalesce(is_active,active,true)=true LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gift not found or inactive'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.live_rooms WHERE id=_room_id AND status <> 'ended') THEN RAISE EXCEPTION 'Room not found or ended'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=_receiver_id) THEN RAISE EXCEPTION 'Receiver profile not found'; END IF;
  v_coins := coalesce(g.price_coins,g.price,0)::bigint * _quantity;
  IF v_coins <= 0 THEN RAISE EXCEPTION 'Gift has no valid coin price'; END IF;
  v_diamonds := floor(v_coins * 0.60)::bigint + coalesce(g.diamonds_value,0)::bigint * _quantity;
  SELECT coins INTO v_sender_coins FROM public.profiles WHERE id=v_sender FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sender profile not found'; END IF;
  IF coalesce(v_sender_coins,0) < v_coins THEN RAISE EXCEPTION 'Insufficient coins'; END IF;
  UPDATE public.profiles SET coins=coalesce(coins,0)-v_coins, updated_at=now() WHERE id=v_sender RETURNING coins INTO v_sender_coins;
  UPDATE public.profiles SET diamonds=coalesce(diamonds,0)+v_diamonds, updated_at=now() WHERE id=_receiver_id;
  INSERT INTO public.gift_sends
    (room_id,sender_id,receiver_id,gift_id,quantity,coins_spent,diamonds_earned,created_at,finalized_at,gift_name,gift_emoji,gift_icon,gift_animation,gift_clip_path,gift_clip_type,gift_image_url,gift_sound_url,gift_audio_url,gift_priority,gift_duration_ms,gift_loop,gift_audio_volume,gift_audio_enabled,gift_render_config)
  VALUES
    (_room_id,v_sender,_receiver_id,_gift_id,_quantity,v_coins,v_diamonds,now(),now(),g.name,g.emoji,g.icon,g.animation,g.clip_path,g.clip_type,g.image_url,g.sound_url,g.audio_url,g.priority,g.duration_ms,g.loop,g.audio_volume,g.audio_enabled,g.render_config)
  RETURNING * INTO v_row;
  INSERT INTO public.wallet_transactions(user_id,kind,coins_delta,diamonds_delta,balance_coins_after,ref_type,ref_id,note)
  VALUES(v_sender,'gift_sent',-v_coins,0,v_sender_coins,'gift',v_row.id,'Sent '||coalesce(g.name,'gift'));
  IF v_diamonds > 0 THEN
    INSERT INTO public.wallet_transactions(user_id,kind,coins_delta,diamonds_delta,ref_type,ref_id,note)
    VALUES(_receiver_id,'gift_received',0,v_diamonds,'gift',v_row.id,'Received '||coalesce(g.name,'gift'));
  END IF;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.send_gift(uuid,uuid,uuid,integer,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_gift(uuid,uuid,uuid,integer,boolean) TO authenticated;

-- Defense in depth for secret/administrative RPCs.
REVOKE ALL ON FUNCTION public.rtc_pick_credential() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rtc_mark_exhausted(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rtc_report_usage(bigint,numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rtc_set_verify_state(integer,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.host_popularity_record_activity(uuid,integer,integer,integer,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ludo_close_match(uuid,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ludo_open_match(uuid,uuid[],integer) FROM PUBLIC, anon;

-- Pin search_path for mutable helper functions flagged by Security Advisor.
ALTER FUNCTION public.update_updated_at_column() SET search_path=public;
ALTER FUNCTION public._sync_banners() SET search_path=public;
ALTER FUNCTION public.recharge_requests_sync_aliases() SET search_path=public;
ALTER FUNCTION public._sync_gifts() SET search_path=public;
ALTER FUNCTION public._sync_coin_packages() SET search_path=public;
ALTER FUNCTION public._sync_wallet_tx() SET search_path=public;
ALTER FUNCTION public.sync_room_message_text() SET search_path=public;
ALTER FUNCTION public.vip_period_start() SET search_path=public;
ALTER FUNCTION public.vip_user_family(uuid) SET search_path=public;
ALTER FUNCTION public._room_seat_lock(uuid) SET search_path=public;
ALTER FUNCTION public.sync_app_studio_document_root() SET search_path=public;
ALTER FUNCTION public._sync_gift_audio() SET search_path=public;
ALTER FUNCTION public._mg_secure_rand() SET search_path=public;
ALTER FUNCTION public.casino_weighted_pick(text,bigint) SET search_path=public;
ALTER FUNCTION public.app_customization_updated_at() SET search_path=public;
