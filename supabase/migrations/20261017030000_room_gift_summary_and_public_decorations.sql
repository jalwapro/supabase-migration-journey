-- Public-safe owned decoration inventory for authenticated profile viewers.
CREATE OR REPLACE FUNCTION public.get_public_user_decorations(_user_id uuid)
RETURNS TABLE(kind text, item_id uuid, name text, media_url text, expires_at timestamptz, is_equipped boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT 'frame'::text, f.id, f.name, COALESCE(f.thumbnail_url, f.image_url), uf.expires_at, false
  FROM public.user_frames uf
  JOIN public.dp_frames f ON f.id = uf.frame_id
  WHERE uf.user_id = _user_id
    AND (uf.expires_at IS NULL OR uf.expires_at > now())
    AND COALESCE(f.is_active, true)
  UNION ALL
  SELECT 'entrance'::text, e.id, e.name, COALESCE(e.thumbnail_url, e.media_url), ue.expires_at, ue.is_equipped
  FROM public.user_entrance_effects ue
  JOIN public.entrance_effects e ON e.id = ue.effect_id
  WHERE ue.user_id = _user_id
    AND (ue.expires_at IS NULL OR ue.expires_at > now())
    AND e.is_active = true
  ORDER BY 1, 2;
$$;
REVOKE ALL ON FUNCTION public.get_public_user_decorations(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_user_decorations(uuid) TO authenticated;

-- Compact, room-scoped gift summary. Does not modify gift-send transactions.
CREATE OR REPLACE FUNCTION public.get_room_user_gift_summary(_room_id uuid, _user_id uuid)
RETURNS TABLE(total_points bigint, gift_count bigint, top_supporters jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.live_rooms r
    WHERE r.id = _room_id AND r.status = 'live'
      AND (r.host_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.room_members m WHERE m.room_id = r.id AND m.user_id = auth.uid()
      ))
  ) THEN
    RAISE EXCEPTION 'room membership required';
  END IF;

  RETURN QUERY
  WITH rows AS (
    SELECT gs.sender_id, SUM(COALESCE(gs.coins_spent,0))::bigint AS points,
           SUM(COALESCE(gs.quantity,0))::bigint AS gifts
    FROM public.gift_sends gs
    WHERE gs.room_id = _room_id AND gs.receiver_id = _user_id
      AND gs.sender_id <> _user_id
    GROUP BY gs.sender_id
  ),
  top_rows AS (
    SELECT r.*, ROW_NUMBER() OVER (ORDER BY r.points DESC, r.gifts DESC, r.sender_id) AS rn
    FROM rows r
  )
  SELECT COALESCE((SELECT SUM(points) FROM rows),0)::bigint,
         COALESCE((SELECT SUM(gifts) FROM rows),0)::bigint,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'user_id', t.sender_id,
             'username', COALESCE(p.username, p.full_name, 'User'),
             'avatar', p.avatar,
             'points', t.points,
             'gifts', t.gifts
           ) ORDER BY t.points DESC, t.gifts DESC)
           FROM top_rows t
           LEFT JOIN public.profiles p ON p.id = t.sender_id
           WHERE t.rn <= 3
         ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.get_room_user_gift_summary(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_room_user_gift_summary(uuid, uuid) TO authenticated;
