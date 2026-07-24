## Goal

Room ko back-button / app-close / disconnect pe **immediately end nahi karna**. Host ke liye **20-minute server-enforced grace period**, home pe **priority recovery card**, aur reclaim vs end ka clear choice.

---

## 1. Database (migration `db/migrations/0156_room_grace_period.sql`)

**Schema changes:**
- `ALTER TYPE public.room_status ADD VALUE 'host_disconnected'` (non-transactional — separate migration file).
- Add columns on `live_rooms`:
  - `host_last_seen_at timestamptz` (host-specific heartbeat, distinct from generic `heartbeat_at`)
  - `host_disconnect_at timestamptz` (when host disconnected)
  - `grace_period_until timestamptz` (server-computed expiry, `host_disconnect_at + interval '20 minutes'`)
- Indexes: `(host_id, status)` partial for recoverable rooms, `(status, grace_period_until)` for cron reaper.

**RPCs (SECURITY DEFINER, all host-authorized via `auth.uid()`):**
- `host_room_heartbeat(_room_id uuid)` — writes `host_last_seen_at = now()`, and if `status='host_disconnected'` and grace still valid, auto-promotes back to `live` (clears disconnect fields). Only callable by host.
- `mark_host_disconnected(_room_id uuid)` — sets `status='host_disconnected'`, `host_disconnect_at=now()`, `grace_period_until=now()+20min`. Idempotent.
- `reclaim_room(_room_id uuid)` — verifies `auth.uid()=host_id` AND `now() < grace_period_until` AND `status='host_disconnected'`; sets `status='live'`, clears disconnect fields, updates `host_last_seen_at`. Returns updated row.
- `end_room(_room_id uuid)` — verifies caller is host or admin; sets `status='ended', ended_at=now()`; calls `finalize_room_gifts` inline. Replaces raw client `UPDATE`.
- `get_my_recoverable_room()` — returns the caller's room where `host_id=auth.uid()` AND `status IN ('live','host_disconnected')` AND (`status='live'` OR `now() < grace_period_until`). Used by home priority card.

**Cron update:**
- Replace `close_stale_rooms()` logic:
  - Phase 1: rooms with `status='live'` AND `host_last_seen_at < now() - 90s` → set `status='host_disconnected'`, start grace period.
  - Phase 2: rooms with `status='host_disconnected'` AND `grace_period_until < now()` → set `status='ended'`, `ended_at=now()`, call `finalize_room_gifts`.
- Keep `pg_cron` schedule at every minute.

**GRANTs:** `EXECUTE ... TO authenticated` for host-facing RPCs; existing `TO service_role` for admin.

---

## 2. Room page (`src/routes/room.$roomId.tsx`)

**Heartbeat:** Update `useRoomHeartbeat` to call `host_room_heartbeat` (not the generic `room_heartbeat`) — this covers auto-reclaim if host had briefly slipped into `host_disconnected`.

**Do NOT hard-end on unload:**
- Audit `onPageHide` / `beforeunload` handler (~line 1047). Remove any `status='ended'` write on unload. Instead, if host, call `mark_host_disconnected` via `navigator.sendBeacon` to a lightweight endpoint (or rely purely on server cron detecting stale heartbeat — simpler and reliable).
- Preferred: **rely on server cron** (heartbeat stops → 90s later cron flips to `host_disconnected`). No unload writes needed. Simpler and matches spec ("don't rely on browser events").

**End Room path:** `doLeaveRoom` host branch → call `end_room` RPC instead of raw table update.

**Handle `host_disconnected` for viewers:**
- Existing kick-on-`ended` effect stays. Add a NEW effect: when `room.data.status === 'host_disconnected'`, show a non-blocking banner "Host reconnecting… time remaining Xm Ys" using `grace_period_until`. Do NOT auto-kick viewers.
- Remove/reduce the client-side AFK-exit path (lines 371–434) — server is now source of truth. Keep only the visual "host away" cup badge derived from `status`.

**Back button:** Already has confirmation for host (lines 1403–1446). No change needed to that flow, but ensure "Leave Room" now transitions to `host_disconnected` via the same code path (i.e., leaving doesn't call `end_room` — it just navigates away; server cron picks it up).
- Actually per spec: pressing Back → "Leave Room?" dialog. Leaving = go home, grace period starts naturally. "End Room" is a separate explicit action inside the room (existing settings sheet or new button in the exit dialog offering both "Leave (keeps room 20min)" and "End Room" options).
- Update exit `AlertDialog` (line 2970) to offer three actions: **Stay**, **Leave Room** (navigate home, grace begins), **End Room** (calls `end_room`).

---

## 3. Room listings (widen filter)

- `db/migrations/0156_…` also update `list_live_rooms_ranked` to include `status IN ('live','host_disconnected')` (keeps room discoverable during grace period per spec).
- `src/routes/index.tsx:188-200` room grid query: same widening.
- Row rendering: badge/overlay "Host away" when `status='host_disconnected'`.

---

## 4. Home priority recovery card (`src/routes/index.tsx`)

- Add `useQuery(["my-active-room", uid], () => rpc("get_my_recoverable_room"))`, `enabled: !!uid`.
- Add `["my-active-room"]` to `useRealtimeInvalidate("home-live", [...])` list.
- Render as sticky top card **above** all other home content when data exists:
  - Title: "Your room is waiting"
  - Live countdown for `grace_period_until - now()` if `status='host_disconnected'`, else "Currently live".
  - Two buttons: **Re-enter Room** (navigates to `/room/$id`; room page's `host_room_heartbeat` on mount will auto-reclaim), **End Room** (confirmation → `end_room` RPC → invalidate query).
- Local dismiss flag (`sessionStorage`) so card doesn't repeat after user made a valid choice (per spec: "must not appear repeatedly after user has already made a valid decision").

---

## 5. Multi-tab / multi-device safety

- Host heartbeat writes `host_last_seen_at` from any active host tab. As long as ONE tab is heartbeating, `host_last_seen_at` stays fresh and cron never flips to `host_disconnected`. Naturally satisfied.
- No explicit session table needed.

---

## 6. Security

- All state transitions go through `SECURITY DEFINER` RPCs with `auth.uid() = host_id` checks. Client cannot:
  - Extend grace period (`grace_period_until` is set server-side from `now() + 20min`, cron enforces).
  - Change ownership (RPCs verify caller).
  - Fake heartbeat for another host (RPC checks `host_id = auth.uid()`).
- RLS on `live_rooms` update policy already restricts to host/admin — keeps as belt-and-suspenders.

---

## 7. Files to touch

**New:**
- `db/migrations/0156_room_grace_period_enum.sql` (ALTER TYPE only, non-transactional)
- `db/migrations/0157_room_grace_period.sql` (columns + RPCs + cron + widen list_live_rooms_ranked)
- `src/components/room/RoomRecoveryCard.tsx` (home priority card)

**Modified:**
- `src/hooks/useRoomHeartbeat.ts` — swap RPC to `host_room_heartbeat`
- `src/routes/room.$roomId.tsx` — remove unload-based ending, use `end_room` RPC, add `host_disconnected` viewer banner, update exit dialog to 3 options, drop client AFK auto-kick
- `src/routes/index.tsx` — add recovery query + card, widen listing filter to include `host_disconnected`

---

## 8. Test coverage (per spec)

Manual verification checklist (I'll run through preview after implementation):
1. Back → confirmation shows, room persists.
2. Close tab → room stays live 90s → flips to `host_disconnected` → recovery card on home.
3. Return within 20 min → card → Re-enter → status auto-flips to `live` via heartbeat.
4. Return within 20 min → End Room → confirmation → `status='ended'`.
5. No return → cron ends room at grace expiry.
6. Refresh mid-room → room persists (heartbeat resumes on mount, auto-reclaims if flipped).
7. Two tabs, close one → other keeps heartbeat, no state change.

---

## Non-goals (out of scope)

- No new TanStack server-function layer — everything routes through Supabase RPCs (matches existing project convention).
- No changes to `finalize_room_gifts` payout logic — called from `end_room` RPC and cron expiry path, same as today's flow moment.
- No changes to viewer exit / `room_members` cleanup.
