-- Manual chroma-key configuration for Shop Items DP frames.
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS chromakey_color text;
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS chromakey_tolerance integer NOT NULL DEFAULT 48;
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS chromakey_softness integer NOT NULL DEFAULT 12;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS frame_chromakey_color text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS frame_chromakey_tolerance integer NOT NULL DEFAULT 48;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS frame_chromakey_softness integer NOT NULL DEFAULT 12;

CREATE OR REPLACE FUNCTION public.equip_cosmetic(_theme_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); slug text; col text; url text; chroma text; tol integer; soft integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.user_owns_theme(uid, _theme_id) THEN RAISE EXCEPTION 'You do not own this item'; END IF;
  SELECT lower(coalesce(c.slug, c.name)), coalesce(t.animation_url, t.preview_url, t.bg_image),
         t.chromakey_color, t.chromakey_tolerance, t.chromakey_softness
    INTO slug, url, chroma, tol, soft
    FROM public.themes t LEFT JOIN public.theme_categories c ON c.id = t.category_id WHERE t.id = _theme_id;
  PERFORM set_config('app.trusted_definer', 'on', true);
  IF slug IS NULL OR slug IN ('theme','themes') THEN
    UPDATE public.profiles SET theme_id = _theme_id WHERE id = uid;
    PERFORM set_config('app.trusted_definer', 'off', true); RETURN 'theme';
  END IF;
  col := CASE
    WHEN slug IN ('frame','frames') THEN 'frame'
    WHEN slug IN ('ring','rings') THEN 'ring'
    WHEN slug IN ('bubble','bubbles','chat bubble') THEN 'bubble'
    WHEN slug IN ('car','cars','vehicle') THEN 'car'
    WHEN slug IN ('entrance','entry','entrance effect') THEN 'entrance'
    WHEN slug IN ('data card','data_card','datacard','card') THEN 'data_card'
    WHEN slug IN ('special id','special_id','specialid') THEN 'special_id'
    ELSE NULL END;
  IF col IS NULL THEN
    PERFORM set_config('app.trusted_definer', 'off', true);
    RAISE EXCEPTION 'This category cannot be equipped yet';
  END IF;
  IF col = 'frame' AND url IS NOT NULL AND chroma IS NOT NULL AND chroma ~ '^[0-9A-Fa-f]{6}$' THEN
    url := split_part(url,'#',1) || '#jalwa-chroma=' || lower(chroma) || '&t=' ||
      greatest(1,least(180,coalesce(tol,48))) || '&s=' || greatest(0,least(80,coalesce(soft,12)));
  END IF;
  EXECUTE format('UPDATE public.profiles SET %I = $1 WHERE id = $2', col) USING url, uid;
  IF col = 'frame' THEN
    UPDATE public.profiles SET frame_chromakey_color=chroma, frame_chromakey_tolerance=coalesce(tol,48),
      frame_chromakey_softness=coalesce(soft,12) WHERE id=uid;
  END IF;
  PERFORM set_config('app.trusted_definer', 'off', true); RETURN col;
END; $$;

CREATE OR REPLACE FUNCTION public.unequip_cosmetic(_slot text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); col text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  col := CASE lower(coalesce(_slot,'')) WHEN 'frame' THEN 'frame' WHEN 'ring' THEN 'ring'
    WHEN 'bubble' THEN 'bubble' WHEN 'car' THEN 'car' WHEN 'entrance' THEN 'entrance'
    WHEN 'data_card' THEN 'data_card' WHEN 'special_id' THEN 'special_id' WHEN 'theme' THEN 'theme_id' ELSE NULL END;
  IF col IS NULL THEN RAISE EXCEPTION 'Unknown slot'; END IF;
  PERFORM set_config('app.trusted_definer','on',true);
  EXECUTE format('UPDATE public.profiles SET %I = NULL WHERE id = $1',col) USING uid;
  IF col='frame' THEN UPDATE public.profiles SET frame_chromakey_color=NULL, frame_chromakey_tolerance=48,
    frame_chromakey_softness=12 WHERE id=uid; END IF;
  PERFORM set_config('app.trusted_definer','off',true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_assign_frame(
  _user_id uuid, _theme_id uuid, _equip boolean DEFAULT true, _expires_at timestamptz DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid := auth.uid(); _theme record; _final_expires_at timestamptz; _frame_url text;
BEGIN
  IF _admin IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_admin(_admin) THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT t.id,t.name,t.animation_url,t.preview_url,t.bg_image,t.duration_days,t.chromakey_color,
         t.chromakey_tolerance,t.chromakey_softness,c.slug AS category_slug,c.name AS category_name
    INTO _theme FROM public.themes t LEFT JOIN public.theme_categories c ON c.id=t.category_id
   WHERE t.id=_theme_id AND (c.slug IN ('frame','frames') OR c.name ILIKE '%frame%');
  IF NOT FOUND THEN RAISE EXCEPTION 'frame not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=_user_id) THEN RAISE EXCEPTION 'user not found'; END IF;
  _frame_url := coalesce(_theme.animation_url,_theme.preview_url,_theme.bg_image);
  IF _frame_url IS NULL THEN RAISE EXCEPTION 'frame has no media'; END IF;
  IF _theme.chromakey_color IS NOT NULL AND _theme.chromakey_color ~ '^[0-9A-Fa-f]{6}$' THEN
    _frame_url := split_part(_frame_url,'#',1) || '#jalwa-chroma=' || lower(_theme.chromakey_color) || '&t=' ||
      greatest(1,least(180,coalesce(_theme.chromakey_tolerance,48))) || '&s=' ||
      greatest(0,least(80,coalesce(_theme.chromakey_softness,12)));
  END IF;
  _final_expires_at := coalesce(_expires_at,case when _theme.duration_days is null then null
    else now()+make_interval(days=>_theme.duration_days) end);
  INSERT INTO public.user_themes(user_id,theme_id,expires_at,purchased_price_diamonds)
    VALUES(_user_id,_theme_id,_final_expires_at,0)
    ON CONFLICT(user_id,theme_id) DO UPDATE SET expires_at=EXCLUDED.expires_at,purchased_price_diamonds=0;
  IF _equip THEN
    UPDATE public.profiles SET frame=_frame_url,frame_chromakey_color=_theme.chromakey_color,
      frame_chromakey_tolerance=coalesce(_theme.chromakey_tolerance,48),
      frame_chromakey_softness=coalesce(_theme.chromakey_softness,12),
      frame_expires_at=_final_expires_at,updated_at=now() WHERE id=_user_id;
  END IF;
  INSERT INTO public.admin_logs(admin_id,action,target,details)
    VALUES(_admin,'assign_frame',_user_id::text,jsonb_build_object('theme_id',_theme_id,'theme_name',_theme.name,
      'equipped',_equip,'expires_at',_final_expires_at,'chromakey_color',_theme.chromakey_color));
END; $$;

GRANT EXECUTE ON FUNCTION public.equip_cosmetic(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unequip_cosmetic(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_frame(uuid,uuid,boolean,timestamptz) TO authenticated;
NOTIFY pgrst,'reload schema';