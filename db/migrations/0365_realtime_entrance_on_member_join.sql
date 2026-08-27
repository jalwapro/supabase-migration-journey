-- 0365: Make every actual room membership join create a durable entrance event.
-- The client-side entrance hook is intentionally kept as a fallback, but the
-- membership INSERT is the authoritative join point used by Home, Chat and
-- Notification room-entry flows.

CREATE OR REPLACE FUNCTION public.fire_room_entrance_for_user(_room_id uuid, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _eff record;
  _prof record;
  _row public.room_entrances;
BEGIN
  IF _room_id IS NULL OR _user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ENTRANCE_TARGET';
  END IF;

  SELECT * INTO _row
    FROM public.room_entrances
   WHERE room_id = _room_id
     AND user_id = _user_id
     AND created_at > now() - interval '20 seconds'
   ORDER BY created_at DESC
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'debounce', 'event', to_jsonb(_row));
  END IF;

  SELECT e.* INTO _eff
    FROM public.user_entrance_effects u
    JOIN public.entrance_effects e ON e.id = u.effect_id
   WHERE u.user_id = _user_id
     AND u.is_equipped = true
     AND e.is_active = true
     AND (u.expires_at IS NULL OR u.expires_at > now())
   LIMIT 1;

  SELECT username, avatar_url, vip_level, country
    INTO _prof
    FROM public.profiles
   WHERE id = _user_id;

  INSERT INTO public.room_entrances
    (room_id,user_id,effect_id,effect_key,media_url,media_type,chromakey,
     sound_url,duration_ms,username,avatar_url,vip_level,country,render_config)
  VALUES
    (_room_id,_user_id,_eff.id,COALESCE(_eff.key,'default_entry'),_eff.media_url,
     _eff.media_type,_eff.chromakey,_eff.sound_url,COALESCE(_eff.duration_ms,2500),
     _prof.username,_prof.avatar_url,COALESCE(_prof.vip_level,0),_prof.country,
     COALESCE(_eff.render_config,'{}'::jsonb))
  RETURNING * INTO _row;

  RETURN jsonb_build_object('ok', true, 'event', to_jsonb(_row));
END;
$$;

REVOKE ALL ON FUNCTION public.fire_room_entrance_for_user(uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fire_room_entrance_for_user(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_room_member_entrance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.fire_room_entrance_for_user(NEW.room_id, NEW.user_id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- A visual entrance must never block an otherwise valid room join.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS room_member_entrance_after_insert ON public.room_members;
CREATE TRIGGER room_member_entrance_after_insert
AFTER INSERT ON public.room_members
FOR EACH ROW
EXECUTE FUNCTION public.trg_room_member_entrance();
