-- Gift System Production Diagnostics
-- Safe read-only checks. No data is modified.

-- STEP 1: Confirm the gift denormalization trigger function currently live.
SELECT pg_get_functiondef('public.gift_sends_fill_denorm()'::regprocedure);

-- STEP 2: Confirm Entrance Studio render_config passthrough is live.
SELECT pg_get_functiondef('public.fire_room_entrance(uuid)'::regprocedure);

-- STEP 3: Optional reproduction test.
-- Replace IDs with real UUIDs before uncommenting. Run in a transaction and rollback.
-- BEGIN;
-- SELECT public.send_gift('<room_id>'::uuid, '<receiver_id>'::uuid, '<gift_id>'::uuid, 1, true);
-- ROLLBACK;

-- STEP 4: Inspect the latest gift_sends denormalized asset/config snapshots.
SELECT id, created_at, gift_id, gift_name, gift_clip_path, gift_clip_type,
       gift_render_config, gift_sound_url, gift_audio_url, gift_duration_ms
  FROM public.gift_sends
 ORDER BY created_at DESC
 LIMIT 50;

-- STEP 5: Confirm gift_sends is in Supabase Realtime publication.
SELECT schemaname, tablename
  FROM pg_publication_tables
 WHERE pubname = 'supabase_realtime'
   AND tablename = 'gift_sends';
