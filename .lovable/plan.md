## 1. Emoji Management System (admin-controlled, tiered)

### DB migration `0229_room_emojis.sql`
- `room_emojis` table: `id`, `code` (e.g. `:jalwa_kiss:`), `name`, `asset_url` (image/lottie/webm), `asset_type` (`static`|`animated`|`lottie`), `tier` (`normal`|`vip`|`svip`|`host_only`), `category` (reactions/love/party/luxury), `sort_order`, `active`, `created_at`
- `GRANT SELECT` to `anon, authenticated`; admin-only writes via `has_role`
- Seed 20 normal + 15 VIP emojis from existing assets

### Admin panel `admin.emojis.tsx`
- Same pattern as `admin.gifts.tsx`: tier tabs (Normal / VIP / SVIP / Host-only), search, inline edit, bulk show/hide
- Upload button (MP4/WebM/PNG/Lottie → storage bucket `emoji-assets`)
- Fields: code, name, category, tier, sort order, active toggle

### Room integration
- Existing emoji sheet me tier tabs add — user ka tier check karke unlocked emojis dikhao, locked ones ke upar 👑 VIP badge + "Upgrade" CTA
- Fetch: `useQuery(['room-emojis', userTier])` filtered by allowed tiers, cached 5 min

## 2. Featured Profile Spotlight (top gifter/host promotion)

Idea: top contributors ko room ke beech me unke DP ke sath ek premium animated frame/gift chalao (jaise TikTok pe "Top Fan" spotlight). User ko lagta hai app pe time dena worth it hai — retention boost.

### DB migration `0230_profile_spotlight.sql`
- `spotlight_triggers` table: `id`, `user_id`, `room_id`, `trigger_type` (`top_gifter_daily`|`top_host_weekly`|`level_up`|`vip_join`), `animation_id`, `triggered_at`, `seen_count`
- `spotlight_animations` table: `id`, `name`, `overlay_asset_url` (frame around DP), `bg_animation_url` (particles/aura), `duration_ms`, `tier_required`, `active`
- Daily cron / trigger: jab user ne top-3 gifter status hasil ki us room me, ya top host ban gaya, auto-spotlight queue me daal do
- RLS: viewers read own room's spotlights, admin manages animations

### Auto-detection SQL
- Trigger on `gift_transactions` insert → recalc daily top gifter per room → if changed, insert into `spotlight_triggers`
- Weekly job for top host by `room_stats.total_gift_coins`

### Room UI component `ProfileSpotlight.tsx`
- Realtime subscription on `spotlight_triggers` filtered by current `room_id`
- Center of screen: 3-second cinematic — user ki big DP + rotating gold aura + label ("👑 Top Gifter Today" / "🔥 Rising Host")
- Auto-dismiss, queue system agar multiple aayein
- Tap → user profile

### Admin panel `admin.spotlights.tsx`
- Manage spotlight animations (upload frame + bg video, set duration, tier)
- Manual trigger: pick user + room + animation → instant spotlight (VIP farmaish ke liye)
- Analytics: kitni baar chali, seen count

## Files to create/modify

**New:**
- `db/migrations/0229_room_emojis.sql`
- `db/migrations/0230_profile_spotlight.sql`
- `src/routes/_authenticated/admin.emojis.tsx`
- `src/routes/_authenticated/admin.spotlights.tsx`
- `src/components/room/ProfileSpotlight.tsx`
- `src/hooks/useRoomEmojis.ts`
- `src/hooks/useProfileSpotlight.ts`

**Modify:**
- `src/routes/room.$roomId.tsx` — emoji sheet tier filter + mount `<ProfileSpotlight />`
- `src/routes/_authenticated/admin.index.tsx` — add cards for Emojis & Spotlights

## Confirm karo:
1. Emoji tiers — sirf `normal` + `vip` chahiye, ya `svip` + `host_only` bhi include karun? (recommend: 4 tiers future-proof)
2. Spotlight auto-triggers — daily top gifter + weekly top host default rakhun? Aur manual admin trigger bhi (VIP request pe)?
3. Animation ke liye abhi placeholder frames use karun (existing gold ring assets se), ya naye cinematic frames generate karun (extra credits)?
