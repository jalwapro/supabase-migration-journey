-- 0316: real Entrance Studio publish pipeline metadata + room playback source.
-- The browser renderer uploads the baked render to R2 and stores the permanent
-- public URL here. fire_room_entrance prefers that URL over the raw source clip.

BEGIN;

ALTER TABLE public.entrance_effects
  ADD COLUMN IF NOT EXISTS published_render_url text,
  ADD COLUMN IF NOT EXISTS published_render_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_render_version text;

CREATE INDEX IF NOT EXISTS idx_entrance_effects_published_render
  ON public.entrance_effects(id) WHERE published_render_url IS NOT NULL;

ALTER TABLE public.room_entrances
  ADD COLUMN IF NOT EXISTS published_render_url text;

-- Keep the latest RPC behaviour (0275 return-row fix) while making the
-- published render the authoritative playback source when one exists.
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
     sound_url, duration_ms, published_render_url, username, avatar_url, vip_level, country)
  VALUES
    (_room_id, _uid, _eff.id, _eff.key,
     COALESCE(_eff.published_render_url, _eff.media_url),
     CASE WHEN _eff.published_render_url IS NOT NULL THEN 'webm' ELSE _eff.media_type END,
     _eff.chromakey, _eff.sound_url, _eff.duration_ms, _eff.published_render_url,
     _prof.username, _prof.avatar_url, COALESCE(_prof.vip_level, 0), _prof.country)
  RETURNING * INTO _row;

  RETURN jsonb_build_object('ok', true, 'event', to_jsonb(_row));
END $function$;

REVOKE ALL ON FUNCTION public.fire_room_entrance(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fire_room_entrance(uuid) TO authenticated;

COMMIT;
