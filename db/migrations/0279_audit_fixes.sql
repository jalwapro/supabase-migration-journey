-- 0279 — Master audit remediation
-- Findings addressed:
--  1. voice-notes / chat-media buckets were PUBLIC while the app serves them
--     through short-lived signed URLs. Anyone with a guessed path could read
--     private voice notes and DM media. Flip them to private.
--  2. 17 "basic" gifts carry clip_type='mp4' with no clip file. The player
--     already falls back to the icon, but the admin panel renders them as
--     broken video rows. Normalise the type to match reality.
--  3. "Romantic Couple" is a full cinematic scene flagged chromakey='green',
--     so the chroma filter punched holes through the footage.
--  4. Two foreign keys on the RTC governance tables had no supporting index.

begin;

-- 1. Private buckets ---------------------------------------------------------
update storage.buckets
   set public = false
 where id in ('voice-notes', 'chat-media')
   and public;

-- 2. Basic gifts are image/emoji pops, not videos ----------------------------
update gifts
   set clip_type = null
 where coalesce(clip_path, '') = ''
   and clip_type is not null;

-- 3. Cinematic footage must never be chroma-keyed ----------------------------
-- Detected by sampling frame corners: this clip's borders are dark scene
-- pixels, not #00FF00, so keying it removed parts of the subject.
update gifts
   set chromakey = 'none'
 where chromakey = 'green'
   and clip_path like '%romantic-02-couple-dance%';

-- Only clips that actually have a key should carry one.
update gifts
   set chromakey = 'none'
 where coalesce(clip_path, '') = ''
   and coalesce(chromakey, 'none') <> 'none';

-- 4. Missing FK indexes ------------------------------------------------------
create index if not exists rtc_config_history_changed_by_idx
  on public.rtc_config_history (changed_by);
create index if not exists rtc_credentials_updated_by_idx
  on public.rtc_credentials (updated_by);

commit;
