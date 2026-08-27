-- 0364: restore Entrance Studio media/config as the authoritative room playback source.
-- 0316 replaced fire_room_entrance() and stopped reading render_config, so
-- Studio-saved source/render settings were ignored by VoiceRoom.

BEGIN;

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
  _media_url text;
  _media_type text;
  _chromakey text;
  _sound_url text;
  _duration_ms integer;
  _published_url text;
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

  -- Priority: published Studio render, then Studio render/source fields,
  -- then the original entrance media as a safe fallback.
  _published_url := COALESCE(
    NULLIF(_eff.published_render_url, ''),
    NULLIF(_cfg->>'published_render_url', ''),
    NULLIF(_cfg->>'rendered_url', '')
  );
  _media_url := COALESCE(
    _published_url,
    NULLIF(_cfg->>'media_url', ''),
    NULLIF(_cfg->>'source_url', ''),
    NULLIF(_cfg->>'clip_url', ''),
    _eff.media_url
  );

  _media_type := COALESCE(
    NULLIF(_cfg->>'media_type', ''),
    CASE WHEN _published_url IS NOT NULL THEN 'webm' END,
    _eff.media_type,
    CASE WHEN _media_url ~* '\\.(mp4|webm|mov)(\\?|$)' THEN 'video' ELSE 'image' END
  );
  _chromakey := COALESCE(NULLIF(_cfg->>'chromakey', ''), NULLIF(_eff.chromakey, ''));
  _sound_url := COALESCE(NULLIF(_cfg->>'sound_url', ''), _eff.sound_url);
  _duration_ms := COALESCE(
    NULLIF(_cfg->>'duration_ms', '')::integer,
    NULLIF(_cfg->>'endMs', '')::integer,
    _eff.duration_ms,
    5000
  );

  SELECT username, avatar AS avatar_url, vip_level, country
    INTO _prof
    FROM public.profiles
   WHERE id = _uid;

  INSERT INTO public.room_entrances
    (room_id, user_id, effect_id, effect_key, media_url, media_type, chromakey,
     sound_url, duration_ms, published_render_url, username, avatar_url, vip_level,
     country, render_config)
  VALUES
    (_room_id, _uid, _eff.id, _eff.key, _media_url, _media_type, _chromakey,
     _sound_url, _duration_ms, _published_url, _prof.username, _prof.avatar_url,
     COALESCE(_prof.vip_level, 0), _prof.country, _cfg)
  RETURNING * INTO _row;

  RETURN jsonb_build_object('ok', true, 'event', to_jsonb(_row));
END;
$function$;

REVOKE ALL ON FUNCTION public.fire_room_entrance(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fire_room_entrance(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
