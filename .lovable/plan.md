# Gift Engine v2: R2 Storage, Real-Time Sync, Audio, Room Chat & Goal Rewards

This is a large upgrade covering asset storage, real-time playback, audio, chat and the gift-goal UI. It is split into phases so each one ships working end-to-end (SQL migration + backend + UI), and nothing is left as a mock.

## Current state (verified)

- Uploads already go to Cloudflare R2 first (`/api/r2-sign` presigned PUT), Supabase Storage only as fallback. A one-time migration already copied all 129 objects to R2 and rewrote DB URLs.
- Gift playback lives in `GiftAnimationPlayer.tsx` (1.9k lines) with `giftAudio.ts` for sound.
- Room page `room.$roomId.tsx` is ~6k lines and holds chat, top-gifter bar and gift events.
- Admin gift management is `admin.gifts.tsx`.

So the R2 part is mostly a hardening/verification job, not a fresh migration.

---

## Phase 1 — R2 as the only asset source (hardening)

- Add a repo-wide audit script that scans `gifts`, `entrance_effects`, `themes`, `emojis`, `profiles`, `banners`, `ads` for any non-R2 asset URL and re-uploads + rewrites stragglers.
- Remove the silent Supabase fallback for gift/admin asset uploads: an upload that cannot reach R2 fails loudly with a clear admin error instead of writing to a second store.
- Server-side upload validation in `/api/r2-sign`: allow-list of extensions/MIME (mp4, webm, json, svg, png, webp, mp3, aac, wav, ogg), per-type max size, path scoping per bucket prefix.
- Any remaining local `public/gifts/*` and `src/assets/gifts-*` references get resolved to R2 URLs at the data layer.

## Phase 2 — Gift asset schema

Migration adds to `gifts` (nullable, backfilled from existing columns): `audio_url`, `thumb_url`, `preview_url`, `duration_ms`, `priority`, `loop`, `is_active`, `audio_volume`, `audio_enabled`. GRANTs + RLS policies included; admin write, public read of active rows.

## Phase 3 — Admin Gift Management upgrade

In `admin.gifts.tsx`: upload/replace/delete for animation, audio, thumbnail and preview; inline audio preview with volume slider, mute and enable toggle; duration auto-detected on upload; priority, loop, category, coin price, active toggle; "Test playback" button that runs the real room playback engine in a modal.

## Phase 4 — Real-time gift engine

- Single broadcast channel per room (`room:{id}:gifts`) so sender, host, co-hosts, audience and PK participants all receive the identical event; server timestamp in payload so every client schedules from the same clock.
- Deduplicate by gift-event id (no double play on realtime + optimistic echo).
- Priority queue with configurable interrupt: high-value gifts can pre-empt lower ones; others play sequentially.
- Preload: room entry prefetches the top gifts' assets; a gift's assets are warmed the moment the sheet opens.
- Audio starts on the same animation frame as the video (single scheduler, shared unlock of the audio context).
- Playback telemetry table: sent / delivered / played / failed, queue wait, playback ms, R2 fetch ms, errors — visible in admin.

## Phase 5 — Voice room chat rebuild

Extract chat out of the 6k-line room file into its own component + hook: virtualized smooth scroll, optimistic instant send with dedupe, auto-scroll with "jump to latest", reply, @mention, emoji, timestamps, read state, reconnect/backfill on WebSocket drop so nothing disappears, mobile-safe layout.

## Phase 6 — Gift Goal system

- Replace the top-gifter progress bar with a small floating circular button showing only the percentage.
- New `room_gift_goals` table + realtime updates so every viewer sees the same percentage without refresh.
- On 100%: play the admin-selected reward gift with its audio and celebration effect (confetti / fireworks / screen flash), then reset to 0% and start again, honouring the cooldown.
- Admin "Goal Rewards" page: target coins, reward gift, reward audio, celebration effect, repeat, cooldown.

## Phase 7 — Performance, network, compatibility

Lazy loading and prefetch, decoded-frame cache with memory cap and cleanup on room exit, hardware-accelerated compositing, adaptive quality on low-end Android, retry with backoff and resume on flaky networks, no crash on failed asset — gift degrades to its thumbnail.

---

## Technical notes

- All schema work goes in `db/migrations/` and is applied with `psql "$JALWA_DB_URL"`, with GRANTs + RLS in the same file.
- No mock data anywhere: every list, admin table and analytics number reads real rows.
- Existing features are preserved; the room file is refactored by extraction, not rewritten.
- Signed URLs stay for private media; gift assets remain public-read on R2 with validation on write.

## Suggested order

Phases 1–4 first (storage correctness + the engine that everything else depends on), then 6 (goal UI, visible win), then 5 (chat rebuild), then 7 (polish). Tell me if you want a different order or want a phase dropped.
