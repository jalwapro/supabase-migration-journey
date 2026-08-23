-- 0313: Fix room entrance RPC profile avatar column.
-- The profiles table stores the avatar in `avatar`; the RPC previously
-- selected `avatar_url`, causing entrance events to fail before insertion.

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
  _row public.room_entrances;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT * INTO _row
    FROM public.room_entrances
   WHERE room_id = _room_id
     AND user_id = _uid
     AND created_at > now() - interval '20 seconds'
   ORDER BY created_at DESC
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'debounce', 'event', to_jsonb(_row));
  END IF;

  SELECT e.* INTO _eff
    FROM public.user_entrance_effects u
    JOIN public.entrance_effects e ON e.id = u.effect_id
   WHERE u.user_id = _uid
     AND u.is_equipped = true
     AND e.is_active = true
     AND (u.expires_at IS NULL OR u.expires_at > now())
   LIMIT 1;

  SELECT username, avatar AS avatar_url, vip_level, country
    INTO _prof
    FROM public.profiles
   WHERE id = _uid;

  INSERT INTO public.room_entrances
    (room_id, user_id, effect_id, effect_key, media_url, media_type, chromakey,
     sound_url, duration_ms, username, avatar_url, vip_level, country, render_config)
  VALUES
    (_room_id,
     _uid,
     _eff.id,
     COALESCE(_eff.key, 'default_entry'),
     _eff.media_url,
     _eff.media_type,
     _eff.chromakey,
     _eff.sound_url,
     COALESCE(_eff.duration_ms, 2500),
     COALESCE(_prof.username, 'User'),
     _prof.avatar_url,
     COALESCE(_prof.vip_level, 0),
     _prof.country,
     COALESCE(_eff.render_config, '{}'::jsonb))
  RETURNING * INTO _row;

  RETURN jsonb_build_object('ok', true, 'event', to_jsonb(_row));
END $$;

REVOKE ALL ON FUNCTION public.fire_room_entrance(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fire_room_entrance(uuid) TO authenticated;
