## Scope (in this order)

### 1. Room lifecycle — auto-close stale rooms
- Migration `0151_room_heartbeat.sql`: add `heartbeat_at timestamptz` on `live_rooms`, index it, RPC `room_heartbeat(room_id)` (host-only update), RPC `close_stale_rooms()` that ends rooms with `heartbeat_at < now() - interval '90 seconds'`, and a `pg_cron` job running it every minute.
- Client: `useRoomHeartbeat(roomId)` ping every 25s while tab is visible; resumes automatically after network drop (survives short offline windows). Host page (`/voice/$roomId`, `/video/$roomId`, `/pk/$roomId`) mounts the hook. `beforeunload` is intentionally NOT used to close rooms — only the missed-heartbeat timeout closes them, so a crashed tab or airplane mode still lets the host reconnect within 90 s.

### 2. Offline presence — hide stale challenges/invites
- Migration `0152_presence.sql`: `user_presence(user_id pk, last_seen_at)` + RPC `touch_presence()`, GRANTs + RLS (public SELECT of `user_seen_recently(uuid)` helper only).
- Client: heartbeat every 30 s from `useAuth`. Random-opponent picker, PK invite, seat invite, and DM "online" dot filter on `last_seen_at > now()-2min`.

### 3. Customer support live chat
- Migration `0153_support_chat.sql`:
  - `support_conversations(id, user_id, assigned_agent uuid, status, last_message_at)`
  - `support_messages(id, conversation_id, sender_id, body, attachments jsonb, created_at)`
  - Role `support_agent` added to `app_role` enum + `has_role` covers it.
  - RLS: user sees only their own conversation; support agents see all; agents can reply.
  - Realtime enabled on both tables.
- UI:
  - User: `/support` — single conversation with agent, WhatsApp-style bubbles, uses existing `chat` primitives.
  - Agent: `/admin/support-chat` — inbox list + thread pane; replaces the old ticket screen (old `/admin/support` becomes a redirect for now, tickets remain viewable read-only).
  - Admin > Users: "Grant support role" toggle.

### 4. Easypaisa merchant account for payments
- Extend `payments` KV block already used on `/admin/payment-accounts` with:
  - `easypaisaMerchantId`, `easypaisaStoreId`, `easypaisaAccountTitle`, `easypaisaIban`.
- Recharge screen: show new Easypaisa Merchant card with copy-to-clipboard, QR from `qrcode` (already in deps) if merchant ID present.
- No live gateway integration (Easypaisa's merchant API needs a signed contract + IPN webhook). I'll wire the display + manual OTP approval flow that already exists. If you want live auto-settlement later, that's a follow-up.

### 5. Share system fixes
- Header 3-dots "Share app" panel: implement `navigator.share` with fallback to copy-link + WhatsApp/Telegram/FB deep links.
- Profile share (`/u/$userId` + `/me`): "Share profile" button uses same helper. Public route `/u/$userId` already works via SSR; add proper `og:image` (avatar) + `og:title` in route `head()` so link previews render on WhatsApp/FB.
- PWA install: manifest already exists; ensure `share_target` is registered so external "Share to Jalwa" works.

### 6. Admin panel polish
- Convert Urdu strings in admin screens (integrations, moderation, notifications hint) to English.
- Fix laggy list screens: add `.limit()` + pagination on Users, Rooms, Recharge, VIP audit tables (some currently pull unbounded).
- Loading skeletons instead of spinner blocks on every admin tab.
- Fix known broken buttons: audit `admin.gifts`, `admin.frames`, `admin.themes` mutations and repair the ones missing `queryClient.invalidateQueries`.

### 7. Theme / light-mode legibility (final pass)
- Rewrite the "adaptive neon" CSS layer in `src/styles.css`:
  - When `html.light` (no shop theme) → force `--foreground`, `--card-foreground`, `--muted-foreground` to dark tokens on every page, remove blanket `text-white → black` remaps that missed streaming/gradient text.
  - When `html.light` + `body[data-active-theme]` (shop theme applied) → force light foreground everywhere, including inputs, dialogs, sheets, sonner toasts.
  - Add tokens for chat bubble text so DMs and room messages stay readable in both modes.
- Audit `me`, `messages`, `settings`, `rank`, `rooms`, `wallet`, `admin` pages against both light/dark and light+theme.

### 8. Suggestions (report only, no code)
Short list of proposed adds/removes/perf wins at the end of the change so you can pick what to do next.

## Notes / trade-offs

- I'll ship migrations under `db/migrations/` — you apply them as usual.
- Easypaisa is display + manual OTP only. Confirm before I add a real gateway later.
- Translating every Urdu string across the entire app is large; I'll cover admin + user-visible screens in this pass. If any leaks remain, tell me the page.
- Removing the old ticket UI is soft (kept read-only). Say the word if you want it deleted.

Proceed?
