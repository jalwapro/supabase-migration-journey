-- 0275: fire_room_entrance returns the inserted entrance row so the joining
-- client can play its own entrance immediately (realtime INSERT often arrives
-- before the channel is subscribed, so the local user never saw their effect).

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
     sound_url, duration_ms, username, avatar_url, vip_level, country)
  VALUES
    (_room_id, _uid, _eff.id, _eff.key, _eff.media_url, _eff.media_type, _eff.chromakey,
     _eff.sound_url, _eff.duration_ms, _prof.username, _prof.avatar_url,
     COALESCE(_prof.vip_level, 0), _prof.country)
  RETURNING * INTO _row;

  RETURN jsonb_build_object('ok', true, 'event', to_jsonb(_row));
END $function$;
