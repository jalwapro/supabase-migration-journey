-- Make the Entrance Studio's saved media authoritative for room playback.
-- Studio media can be stored in render_config.media_url / source_url / clip_url;
-- original purchased/equipped effect media remains the fallback.

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
  _cfg jsonb;
  _studio_media_url text;
  _studio_media_type text;
  _studio_chromakey text;
  _studio_sound_url text;
  _studio_duration_ms integer;
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
   WHERE u.user_id = _uid
     AND u.is_equipped = true
     AND e.is_active = true
     AND (u.expires_at IS NULL OR u.expires_at > now())
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'no_effect');
  END IF;

  _cfg := COALESCE(_eff.render_config, '{}'::jsonb);

  -- Priority: exact media saved by Entrance Studio -> configured effect media.
  _studio_media_url := COALESCE(
    NULLIF(_cfg->>'published_render_url', ''),
    NULLIF(_cfg->>'rendered_url', ''),
    NULLIF(_cfg->>'media_url', ''),
    NULLIF(_cfg->>'source_url', ''),
    NULLIF(_cfg->>'clip_url', ''),
    _eff.media_url
  );
  _studio_media_type := COALESCE(
    NULLIF(_cfg->>'media_type', ''),
    _eff.media_type,
    CASE WHEN _studio_media_url ~* '\.(mp4|webm|mov)(\?|$)' THEN 'video' ELSE 'image' END
  );
  _studio_chromakey := COALESCE(NULLIF(_cfg->>'chromakey', ''), _eff.chromakey);
  _studio_sound_url := COALESCE(NULLIF(_cfg->>'sound_url', ''), _eff.sound_url);
  _studio_duration_ms := COALESCE(NULLIF(_cfg->>'duration_ms', '')::integer, _eff.duration_ms, 5000);

  SELECT username, avatar AS avatar_url, vip_level, country
    INTO _prof
    FROM public.profiles
   WHERE id = _uid;

  INSERT INTO public.room_entrances
    (room_id, user_id, effect_id, effect_key, media_url, media_type, chromakey,
     sound_url, duration_ms, username, avatar_url, vip_level, country, render_config)
  VALUES
    (_room_id, _uid, _eff.id, _eff.key, _studio_media_url, _studio_media_type, _studio_chromakey,
     _studio_sound_url, _studio_duration_ms, _prof.username, _prof.avatar_url,
     COALESCE(_prof.vip_level, 0), _prof.country, _cfg)
  RETURNING * INTO _row;

  RETURN jsonb_build_object('ok', true, 'event', to_jsonb(_row));
END;
$function$;

NOTIFY pgrst, 'reload schema';
