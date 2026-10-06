-- Admin performance consolidation and atomic App Studio publishing.
-- No LiveKit token/room APIs are modified.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_profiles_created_at_id
  ON public.profiles(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_status_created
  ON public.profiles(status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_vip_level
  ON public.profiles(is_vip, vip_level);
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm
  ON public.profiles USING gin (lower(username) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm
  ON public.profiles USING gin (lower(full_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_user_code_trgm
  ON public.profiles USING gin (lower(user_code) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_recharge_status_created
  ON public.recharge_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_status_created
  ON public.withdrawal_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_reports_status_created
  ON public.user_reports(status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_live_rooms_status_created
  ON public.live_rooms(status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_room_popularity_room
  ON public.room_popularity(room_id);

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_summary(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_days INTEGER := GREATEST(1, (p_to::date - p_from::date) + 1);
BEGIN
  IF NOT public.room_layout_admin() THEN
    RAISE EXCEPTION 'Admin authorization required';
  END IF;

  SELECT jsonb_build_object(
    'users', (SELECT count(*) FROM public.profiles),
    'rooms', (SELECT count(*) FROM public.live_rooms),
    'live_rooms', (SELECT count(*) FROM public.live_rooms WHERE status = 'live'),
    'voice_rooms', (SELECT count(*) FROM public.live_rooms WHERE status = 'live' AND room_type = 'voice'),
    'video_rooms', (SELECT count(*) FROM public.live_rooms WHERE status = 'live' AND room_type = 'video'),
    'pending_recharge', (SELECT count(*) FROM public.recharge_requests WHERE status = 'pending'),
    'pending_withdrawal', (SELECT count(*) FROM public.withdrawal_requests WHERE status = 'pending'),
    'pending_reports', (SELECT count(*) FROM public.user_reports WHERE status = 'pending'),
    'vip_users', (SELECT count(*) FROM public.profiles WHERE is_vip = true),
    'new_users', (SELECT count(*) FROM public.profiles WHERE created_at >= p_from AND created_at <= p_to),
    'approved_recharges', (SELECT count(*) FROM public.recharge_requests WHERE status = 'approved' AND created_at >= p_from AND created_at <= p_to),
    'revenue', COALESCE((SELECT sum(amount_pkr) FROM public.recharge_requests WHERE status = 'approved' AND created_at >= p_from AND created_at <= p_to), 0),
    'withdrawn', COALESCE((SELECT sum(amount_pkr) FROM public.withdrawal_requests WHERE status = 'approved' AND created_at >= p_from AND created_at <= p_to), 0),
    'coins_circulation', COALESCE((SELECT sum(coins) FROM public.profiles), 0),
    'revenue_series', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', bucket_key, 'name', bucket_name, 'value', total) ORDER BY bucket_start)
      FROM (
        SELECT
          date_trunc(CASE WHEN v_days > 120 THEN 'month' ELSE 'day' END, created_at) AS bucket_start,
          to_char(date_trunc(CASE WHEN v_days > 120 THEN 'month' ELSE 'day' END, created_at),
            CASE WHEN v_days > 120 THEN 'Mon YY' ELSE 'Mon DD' END) AS bucket_name,
          to_char(date_trunc(CASE WHEN v_days > 120 THEN 'month' ELSE 'day' END, created_at), 'YYYY-MM-DD') AS bucket_key,
          sum(amount_pkr) AS total
        FROM public.recharge_requests
        WHERE status = 'approved' AND created_at >= p_from AND created_at <= p_to
        GROUP BY 1,2,3
      ) s
    ), '[]'::jsonb),
    'recent_activity', COALESCE((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.when_at DESC)
      FROM (
        SELECT 'recharge'::text AS kind, id::text AS id, created_at AS when_at,
          'Recharge ' || status AS label,
          to_char(COALESCE(coins_expected,0), 'FM999,999,999,990') || ' coins' AS sub,
          '+PKR ' || to_char(COALESCE(amount_pkr,0), 'FM999,999,999,990') AS amount,
          'text-emerald-400'::text AS tone
        FROM public.recharge_requests
        ORDER BY created_at DESC LIMIT 4
      ) a
    ), '[]'::jsonb)
  ) INTO v_result;

  -- Replace the activity array with a merged top-10 stream from the three sources.
  v_result := jsonb_set(v_result, '{recent_activity}', COALESCE((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.when_at DESC)
    FROM (
      SELECT 'recharge'::text kind, 'r-' || id::text id, created_at when_at,
        'Recharge ' || status label,
        to_char(COALESCE(coins_expected,0), 'FM999,999,999,990') || ' coins' sub,
        '+PKR ' || to_char(COALESCE(amount_pkr,0), 'FM999,999,999,990') amount,
        'text-emerald-400'::text tone
      FROM public.recharge_requests ORDER BY created_at DESC LIMIT 4
      UNION ALL
      SELECT 'withdraw', 'w-' || id::text, created_at,
        'Withdrawal ' || status, 'Diamond cash-out',
        '-PKR ' || to_char(COALESCE(amount_pkr,0), 'FM999,999,999,990'),
        'text-red-400'
      FROM public.withdrawal_requests ORDER BY created_at DESC LIMIT 4
      UNION ALL
      SELECT 'signup', 'u-' || id::text, created_at,
        '@' || COALESCE(username,'user') || ' joined', 'New signup', NULL,
        'text-primary'
      FROM public.profiles ORDER BY created_at DESC LIMIT 4
    ) x LIMIT 10
  ), '[]'::jsonb);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_dashboard_summary(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_live_rooms(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  id UUID,
  title TEXT,
  room_type TEXT,
  cover_url TEXT,
  viewer_count INTEGER,
  seat_count INTEGER,
  host_id UUID,
  created_at TIMESTAMPTZ,
  coin_score NUMERIC,
  username TEXT,
  avatar TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id, r.title, r.room_type, r.cover_url, r.viewer_count, r.seat_count,
    r.host_id, r.created_at, COALESCE(p.coin_score,0),
    u.username, u.avatar
  FROM public.live_rooms r
  LEFT JOIN public.room_popularity p ON p.room_id = r.id
  LEFT JOIN public.profiles u ON u.id = r.host_id
  WHERE r.status = 'live'
  ORDER BY COALESCE(p.coin_score,0) DESC, COALESCE(r.viewer_count,0) DESC, r.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 200));
$$;

REVOKE ALL ON FUNCTION public.get_admin_live_rooms(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_live_rooms(INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_reports(
  p_status TEXT,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  reporter_id UUID,
  reporter_username TEXT,
  reporter_avatar TEXT,
  reported_user_id UUID,
  reported_username TEXT,
  reported_avatar TEXT,
  room_id UUID,
  room_title TEXT,
  reason TEXT,
  details TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.reporter_id, rp.username, rp.avatar,
         r.reported_user_id, tp.username, tp.avatar,
         r.room_id, lr.title, r.reason, r.details, r.status, r.created_at
  FROM public.user_reports r
  LEFT JOIN public.profiles rp ON rp.id = r.reporter_id
  LEFT JOIN public.profiles tp ON tp.id = r.reported_user_id
  LEFT JOIN public.live_rooms lr ON lr.id = r.room_id
  WHERE r.status = p_status
  ORDER BY r.created_at DESC, r.id DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100))
  OFFSET GREATEST(0, p_offset);
$$;

REVOKE ALL ON FUNCTION public.get_admin_reports(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_reports(TEXT, INTEGER, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_app_customization_draft(
  p_page_id UUID,
  p_config JSONB
)
RETURNS public.app_customization_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.app_customization_versions%ROWTYPE;
  v_version INTEGER;
BEGIN
  IF NOT public.room_layout_admin() THEN
    RAISE EXCEPTION 'App Studio requires admin authorization';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_page_id::text));

  SELECT * INTO v_row
  FROM public.app_customization_versions
  WHERE page_id = p_page_id AND status = 'draft'
  ORDER BY version DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.app_customization_versions
    SET config = p_config, created_by = auth.uid()
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  ELSE
    SELECT COALESCE(MAX(version),0) + 1 INTO v_version
    FROM public.app_customization_versions
    WHERE page_id = p_page_id;

    INSERT INTO public.app_customization_versions(page_id,version,status,config,created_by)
    VALUES(p_page_id,v_version,'draft',p_config,auth.uid())
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.save_app_customization_draft(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_app_customization_draft(UUID, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_app_customization(
  p_page_id UUID,
  p_config JSONB
)
RETURNS public.app_customization_published
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version INTEGER;
  v_version_row public.app_customization_versions%ROWTYPE;
  v_published public.app_customization_published%ROWTYPE;
BEGIN
  IF NOT public.room_layout_admin() THEN
    RAISE EXCEPTION 'App Studio requires admin authorization';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_page_id::text));

  SELECT COALESCE(MAX(version),0) + 1 INTO v_version
  FROM public.app_customization_versions
  WHERE page_id = p_page_id;

  INSERT INTO public.app_customization_versions(
    page_id, version, status, config, created_by, published_at
  )
  VALUES(p_page_id, v_version, 'published', p_config, auth.uid(), NOW())
  RETURNING * INTO v_version_row;

  UPDATE public.app_customization_published
  SET is_current = false
  WHERE page_id = p_page_id AND is_current = true;

  INSERT INTO public.app_customization_published(
    page_id, version_id, config, version, published_by, published_at, is_current
  )
  VALUES(
    p_page_id, v_version_row.id, p_config, v_version, auth.uid(), NOW(), true
  )
  RETURNING * INTO v_published;

  RETURN v_published;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_app_customization(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_app_customization(UUID, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
