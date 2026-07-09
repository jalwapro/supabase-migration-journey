# Notifications System — Full Setup

Jalwa ke liye complete notifications stack. Sab kuch DB-driven, realtime, aur multi-channel (in-app + web push + native push + email).

## 1. Database (migration `0044_notifications.sql`)

**`notification_kind` enum** — sab events:
- Social: `friend_request`, `friend_accept`, `dm_new`, `mention`
- Room: `host_live`, `seat_invite`, `mod_added`, `kicked`
- Economy: `gift_received`, `recharge_approved`, `recharge_rejected`, `withdrawal_approved`, `withdrawal_rejected`, `vip_expiring`, `vip_expired`
- Admin: `system_broadcast`, `account_warning`, `account_action`

**`notifications` table** — per-user feed
```
id, user_id, kind, title, body, data jsonb, actor_id, entity_type, entity_id,
read_at, created_at
```
Indexes: `(user_id, created_at desc)`, `(user_id, read_at)`. Realtime enabled.
RLS: user reads/updates apni, service_role sab kuch.

**`notification_prefs` table** — per-user channel toggles
```
user_id pk, in_app jsonb, push jsonb, email jsonb (kind → bool maps),
push_enabled, email_enabled, updated_at
```
Default: sab in_app on; push/email selective (gift, recharge, host_live, dm, broadcast).

**`push_subscriptions` table** — device tokens
```
id, user_id, platform (web|android|ios), endpoint, p256dh, auth, fcm_token,
user_agent, last_seen, created_at
unique(user_id, endpoint)
```

**Trigger functions** — auto-insert notifications:
- `on_friend_request_insert` → notify addressee
- `on_friendship_accepted` → notify requester
- `on_dm_insert` → notify receiver
- `on_gift_insert` → notify recipient host
- `on_recharge_status_change` → notify user
- `on_withdrawal_status_change` → notify user
- `on_seat_invite_insert` → notify invitee
- `on_room_moderator_insert` → notify user
- `on_rooms_live_change` → fan-out to followers (host_live)

Har trigger `pg_notify('notif_push', json)` bhi karega so backend push worker sun sake.

## 2. Backend server functions (`src/lib/notifications.functions.ts`)

- `listNotifications({ limit, cursor })` — paginated feed
- `markRead({ ids })` / `markAllRead()`
- `getUnreadCount()`
- `getPrefs()` / `updatePrefs({ channel, kind, enabled })`
- `registerPushSubscription({ platform, endpoint, keys, fcmToken })`
- `unregisterPushSubscription({ endpoint })`
- `sendBroadcast({ title, body, kind })` — admin only, uses `supabaseAdmin` after `has_role('admin')` check

Server helper `src/lib/push-dispatch.server.ts`:
- Web Push via `web-push` npm — VAPID keys from secrets
- FCM via HTTP v1 API — service account JSON from secret
- APNs via FCM (same path for iOS through Capacitor)

Public route `src/routes/api/public/push-worker.ts` — cron/pg webhook target that reads pending pushes queue and dispatches. HMAC signature verified.

## 3. Web Push (PWA)

- Add `firebase-messaging-sw.js` OR standalone `push-sw.js` for VAPID web-push (choose VAPID — simpler, no Firebase).
- `src/lib/webpush.ts` — subscribe helper: register SW, `pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC })`, POST to `registerPushSubscription`.
- Called from `InstallPermissionGate` after mic/cam grant, and from notification prefs screen.

## 4. Native push (Capacitor)

- `bun add @capacitor/push-notifications`
- `src/lib/native-push.ts` — `PushNotifications.register()`, on token → `registerPushSubscription({ platform: 'android'|'ios', fcmToken })`.
- Wired in `initNativeShell()` after user auth.
- FCM setup docs added to `NATIVE_APP.md`. iOS requires APNs cert in Firebase console.

## 5. Email notifications

- Reuse existing SMTP (`src/lib/email.server.ts`).
- `sendNotificationEmail(userId, kind, payload)` helper — respects `notification_prefs.email`.
- Templates for: gift big-value, recharge approved/rejected, withdrawal status, VIP expiring, admin warning.
- Triggered from push-worker alongside push send.

## 6. Frontend UI

**Bell icon in `AppShell`** — right side, badge shows unread count (React Query `getUnreadCount` + realtime sub on `notifications`).

**`src/routes/_authenticated/notifications.tsx`** — full feed page:
- Tabs: All / Social / Room / Economy / System
- Swipe/click to mark read
- Actions per kind (accept friend, open room, view gift)
- Pull to refresh, infinite scroll

**`src/routes/_authenticated/settings.notifications.tsx`** — prefs UI:
- Per-kind toggle grid (in-app / push / email columns)
- Master push toggle → triggers browser/native permission request
- "Test notification" button

**Toast on new notification** — realtime subscriber in root shows sonner toast when new row arrives.

## 7. Admin panel

**`src/routes/_authenticated/admin.notifications.tsx`**:
- Compose broadcast (title, body, target: all/vip/hosts/specific-user)
- History of sent broadcasts with delivery stats
- Global on/off per notification kind (feature flag in `app_settings`)

## 8. Secrets required

- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — generate via `generate_secret`
- `VAPID_SUBJECT` — mailto:admin@jalwa
- `FCM_SERVICE_ACCOUNT_JSON` — user pastes from Firebase console
- `PUSH_WORKER_SECRET` — HMAC for cron webhook

VAPID public key exposed as `VITE_VAPID_PUBLIC_KEY` for browser subscribe.

## Rollout order

1. Migration + triggers (data flows from day 1)
2. Server functions + bell icon + feed page + prefs page (in-app works)
3. Web push (VAPID + SW + subscribe flow)
4. Native push (Capacitor + FCM)
5. Email channel
6. Admin broadcast UI

---

**Scope check before I start:** Yeh bara kaam hai (~8-10 files new, 4 migrations worth of SQL, 3 new secrets). Kya main pura ek saath karun, ya phase-by-phase (pehle in-app + bell, phir push, phir email)?
