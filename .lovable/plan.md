# Room Entrance Animation System

End-to-end VIP room entrance effects: shop → purchase → equip → auto-play when the user joins any room, with an admin panel to manage the catalog.

## What ships

### 1. Database (migration `0255_entrance_effects.sql`)
- `entrance_effects` — catalog: `id, key, name, description, category, media_url, media_type` (mp4/webm/lottie/svga), `thumbnail_url, sound_url, duration_ms, price_coins, min_vip_level, is_active, is_limited, starts_at, ends_at, sort_order`.
- `user_entrance_effects` — ownership + equipped: `user_id, effect_id, purchased_at, expires_at, is_equipped` (unique partial index enforces one equipped per user).
- `entrance_purchases` — audit log for stats.
- RPCs (SECURITY DEFINER, wallet-atomic):
  - `purchase_entrance_effect(effect_id)` — checks VIP tier, deducts coins via existing wallet fn, inserts ownership.
  - `equip_entrance_effect(effect_id)` — sets `is_equipped=true`, un-equips others.
  - `unequip_entrance_effect()`.
  - `admin_upsert_entrance_effect(...)`, `admin_delete_entrance_effect(id)`.
- GRANTs + RLS: catalog readable by anon; ownership readable by owner only; admin RPCs gated by `has_role`.
- Seed 20 built-in effect rows across all 20 categories with vector SVG placeholders (Golden Throne, Flying Dragon, Phoenix Rebirth, Space Portal, Neon Cyber, etc.) so the shop is populated on day one.

### 2. Playback infra
- **`src/lib/entrance/registry.ts`** — resolves an effect's media (mp4/webm/lottie/svga), thumbnail, and sound with fallback + preload helper.
- **`src/components/room/EntrancePlayer.tsx`** — full-screen overlay inside a room:
  - Renders Video (mp4/webm with chromakey filter), Lottie (via `lottie-react`), or SVGA (via existing `SvgaPlayer`).
  - Shows user card overlay: `LevelAvatar` (with equipped frame), username, VIP tier, badge, country flag, agency tag.
  - Plays sound via `<audio>` — does NOT interrupt Zego stream (separate `AudioContext`).
  - 2–3s configurable duration; auto-fades out.
  - Respects `prefers-reduced-motion` and skips on `navigator.connection.effectiveType === 'slow-2g' | '2g'`.
- **`src/hooks/useRoomEntrances.ts`** — subscribes to `room_events` (existing) filtered to `type='user_joined'`, dedupes, resolves the joining user's equipped effect from `user_entrance_effects` + `entrance_effects`, enqueues a single-slot playback queue.
- Wired into `src/routes/room.$roomId.tsx` — mounts `<EntrancePlayer />` above the room UI; doesn't pause Zego audio.
- On join: existing `join_room` flow already writes to `room_events`; add a `entrance_effect_key` snapshot so viewers don't need to re-query.

### 3. Profile Shop redesign — `src/routes/_authenticated/shop.tsx`
Replace flat grid with tabbed sections:
- Avatar Frames · **Entrance Effects** · Chat Bubbles · Name Plates · Badges · Ride Effects.
- Each Entrance card: video preview (autoplay muted loop on hover / tap), name, description, duration, quality badge, price (💰), VIP requirement chip, and one of: `Purchase` / `Equip` / `Equipped ✓` / `🔒 VIP Lv X`.
- Fullscreen preview modal with sound test.
- New route `src/routes/_authenticated/shop.entrances.tsx` for a dedicated deep-link.

### 4. Profile — "My Entrances" tab
- `src/routes/_authenticated/me.entrances.tsx` — owned list, equip/unequip, "expires in Xd" for limited items.
- Add a tab entry in the existing profile tab strip.

### 5. Admin panel
- New route `src/routes/_authenticated/admin.entrances.tsx` (Users & Rooms nav group):
  - Upload MP4/WebM/Lottie(.json)/SVGA(.svga) + thumbnail + optional sound to `shop-assets/entrances/` via existing `FileUploader`.
  - Fields: name, description, category (20 presets), price, min VIP level, duration, chromakey, active toggle, limited-time window.
  - Grid of all effects with edit / toggle-active / delete + purchase-count stats (COUNT from `entrance_purchases`).
- Add sidebar link in `AdminShell.tsx`.

### 6. Design language
- Reuse existing tokens (`--gold`, `--primary`, `--secondary`), glassmorphism cards (`backdrop-blur-xl`, `bg-white/[0.03]`), gold ornaments matching `JalwaFrame` visual family. Cinematic entrance frame borders animated via CSS `@keyframes` in `styles.css`.

## Out of scope (this turn)
- Recording real motion-graphics MP4s — the seed uses vector SVG entrances that already look premium. Admin can upload real MP4s any time; playback path handles them from day one.
- Chat Bubbles / Name Plates / Ride Effects tabs are added as empty tab shells (existing systems will slot in later).

## Ready to build?
Confirm and I'll ship the migration + all files above in one pass.
