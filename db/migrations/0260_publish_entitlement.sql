-- 0260_publish_entitlement.sql
-- Broken access control fix: /api/zego-token minted a *publisher* token for any
-- signed-in user for any channel, so a viewer could push audio/video into a room
-- they were never seated in. Entitlement is now decided server-side.

CREATE OR REPLACE FUNCTION public.can_publish_in_channel(_user_id uuid, _channel text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.live_rooms r
     WHERE r.rtc_channel = _channel
       AND r.status <> 'ended'
       AND (
         -- room host
         r.host_id = _user_id
         -- seated user (voice/video seats)
         OR EXISTS (
           SELECT 1 FROM public.room_members m
            WHERE m.room_id = r.id AND m.user_id = _user_id
         )
         -- PK opponent broadcasting into this room
         OR EXISTS (
           SELECT 1 FROM public.pk_matches p
            WHERE p.status IN ('pending', 'active', 'live')
              AND (p.room_a = r.id OR p.room_b = r.id)
              AND (p.host_a = _user_id OR p.host_b = _user_id)
         )
         -- room moderators
         OR EXISTS (
           SELECT 1 FROM public.room_participants rp
            WHERE rp.room_id = r.id AND rp.user_id = _user_id AND rp.is_moderator
         )
       )
  );
$$;

REVOKE ALL ON FUNCTION public.can_publish_in_channel(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_publish_in_channel(uuid, text) TO authenticated, service_role;
