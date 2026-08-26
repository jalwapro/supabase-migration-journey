-- 0363: Fix regression introduced in 0316_entrance_published_render_pipeline.
--
-- ROOT CAUSE:
-- Migration 0310 correctly added `render_config` to both `entrance_effects`
-- and `room_entrances`, and passed it through in fire_room_entrance().
-- Migration 0316 (published-render pipeline) REPLACED fire_room_entrance()
-- to prefer entrance_effects.published_render_url, but its INSERT column
-- list dropped `render_config` entirely. Since `room_entrances.render_config`
-- has no default, every entrance fired after 0316 landed with
-- render_config = NULL, so Entrance Studio settings (crop/position/scale/
-- chroma key/timing) saved in the Admin Panel were silently discarded before
-- ever reaching the Voice Room's EntrancePlayer.
--
-- This migration restores render_config passthrough while KEEPING 0316's
-- published_render_url priority logic (Published/Rendered Studio Asset >
-- Configured Original Asset). No destructive changes; function replaced
-- in place, no data deleted.

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
     sound_url, duration_ms, published_render_url, render_config,
     username, avatar_url, vip_level, country)
  VALUES
    (_room_id, _uid, _eff.id, _eff.key,
     COALESCE(_eff.published_render_url, _eff.media_url),
     CASE WHEN _eff.published_render_url IS NOT NULL THEN 'webm' ELSE _eff.media_type END,
     _eff.chromakey, _eff.sound_url, _eff.duration_ms, _eff.published_render_url,
     COALESCE(_eff.render_config, '{}'::jsonb),
     _prof.username, _prof.avatar_url, COALESCE(_prof.vip_level, 0), _prof.country)
  RETURNING * INTO _row;

  RETURN jsonb_build_object('ok', true, 'event', to_jsonb(_row));
END $function$;

REVOKE ALL ON FUNCTION public.fire_room_entrance(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fire_room_entrance(uuid) TO authenticated;

-- Backfill: recent entrances fired in the last 24h that lost their config
-- (created_at after this window went out) so any still-visible history/replay
-- reflects the Studio's real settings instead of an empty {} config.
UPDATE public.room_entrances r
   SET render_config = e.render_config
  FROM public.entrance_effects e
 WHERE r.effect_id = e.id
   AND r.render_config IS NULL
   AND r.created_at > now() - interval '24 hours';

NOTIFY pgrst, 'reload schema';

COMMIT;
