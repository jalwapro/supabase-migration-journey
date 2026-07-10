# Jalwa VIP Gifting System — Implementation Plan

Ye plan aapkay diye hue spec ko phased tareeqay se implement karega. Sara kaam **level = lifetime gift sent** ke around hoga, aur ye existing `profiles.total_gifted_coins` + `gift_sends` trigger ke upper build hoga (migration 0052 already live hai).

Bohat bara scope hai, is liye main ise phases me deliver karonga taaki har phase testable ho aur aap real users pe safely rollout kar saken.

---

## Phase 1 — Level Engine & Data Model (SQL migration 0053)

**Formula (100 level, aapke targets ke qareeb):**
- Level 1–10: exact aapki table (1M, 3M, 6M, 10M, 15M, 21M, 28M, 36M, 45M, 55M).
- Level 11–100: smooth polynomial jo aapke anchor points (L20≈410M, L30≈1.56B, L50≈7.96B, L100≈190B) hit kare. Ek `LEVEL_THRESHOLDS: bigint[101]` array `src/lib/vip-levels.ts` me generate hoga (build-time constant) — DB aur client dono isi ko use karenge. Never-decrease invariant DB trigger me enforce.

**New tables / columns:**
- `profiles`: add `vip_level int`, `vip_tier text`, `vip_title text`, `total_gifted_coins bigint` (exists), `updated_vip_at timestamptz`.
- `vip_level_config` (100 rows, admin-editable): `level, threshold_coins, tier, title, badge_url, frame_url, bubble_url, entrance_url, name_color, reward_coins, reward_bundle jsonb, privileges jsonb`.
- `vip_rewards_claimed`: `user_id, level, claimed_at` (milestone rewards).
- `vip_level_events`: `user_id, from_level, to_level, at` (for notifications + admin logs).
- `vip_admin_logs`: admin actions (grant/reset/ban/etc).

**Trigger update:** `tg_gift_sender_level_progress` ko rewrite karke `vip_level_config` se lookup karega, `vip_level`, `vip_tier`, `vip_title` set karega, aur naye level pe `vip_level_events` + `notifications` insert karega. Never-decrease guard: `GREATEST(vip_level, new_level)`.

**GRANTs + RLS** har table pe (per project rules).

## Phase 2 — Shared Client Library (`src/lib/vip.ts`)

- `LEVEL_THRESHOLDS`, `tierForLevel(level)`, `titleForLevel(level)`, `progressFor(total)` → `{ level, currentLevelGift, nextLevelGift, remaining, pct }`.
- Tier map (11 tiers: Bronze 1-10 … Jalwa King 100) with color + gradient + glow tokens (royal violet + gold palette per project memory).
- `useVipProfile(userId)` React Query hook + realtime `postgres_changes` sub on `profiles` row → auto refresh across profile / rooms / chat / rankings **without page reload**.

## Phase 3 — UI Components

New under `src/components/vip/`:
- `VipBadge` (animated, per-tier gradient + icon).
- `VipProgressBar` (current / required / remaining / % / next reward, animated fill).
- `VipFrame`, `VipChatBubble`, `VipEntrance`, `VipNameLabel` (colored + animated name), `VipUserCard`.
- `VipRewardsGrid` (unlocked / locked per level).
- Wire into:
  - `src/routes/_authenticated/me.tsx` and `u.$userId.tsx` (profile hero + progress + rewards).
  - `src/routes/room.$roomId.tsx` chat rows (already has `LevelChip` — upgrade to `VipBadge` + colored name + bubble), entrance banner, top-gifter crown, seat borders.
  - `rank.tsx` leaderboards (see Phase 5).

**Assets strategy (important):** 100 fully unique hand-made animations realistic nahi. Solution: **11 tier base assets** (SVG + Lottie-ready) + **procedural per-level variations** (hue shift, glow intensity, particle count, ring segments) driven by CSS custom properties — visually har level unique lagta hai, but maintainable. Aap baad me admin panel se kisi bhi level ke liye custom asset URL upload kar sakte hain (`vip_level_config` already supports it).

## Phase 4 — Notifications

Trigger jab level barhe → `notifications` table me row (existing infra 0044/0047) with type `vip_level_up` + payload `{ level, tier, title, rewards }`. `NotificationPopup` me VIP variant add karenge (gold confetti + badge reveal).

## Phase 5 — Leaderboards

`rank.tsx` extend: tabs **Global / Country / Family / Agency** × **Daily / Weekly / Monthly / Yearly / All-time**. Server side aggregation via SQL views + indexed `gift_sends(created_at, sender_id, coins_spent)`. Paginated, React Query cached (per scale rule).

## Phase 6 — Admin Panel

New route `_authenticated/admin.vip-levels.tsx`:
- Edit `vip_level_config` (thresholds, titles, assets, rewards, privileges).
- User search → grant/deduct coins, force level, reset, ban VIP, view history/logs, export CSV.
All actions go through `createServerFn` with `requireSupabaseAuth` + `has_role('admin')` check, writing to `vip_admin_logs`.

## Phase 7 — Privileges Enforcement

- Chat: higher `vip_level` → priority sort within same second window (server side in room message query).
- Room list: `vip_level = 100` users' hosted rooms pinned on top of `rooms.tsx`.
- Exclusive emojis/stickers gated by `vip_level >= X` in `ChatEmojiSheet`.
- Priority seat/entry: seat request queue orders by `vip_level DESC`.

---

## Deliverable order I recommend

1. **Phase 1 + 2** (migration + shared lib + realtime hook) — foundation.
2. **Phase 3** profile + chat UI (immediate visible value).
3. **Phase 4** notifications.
4. **Phase 5** leaderboards.
5. **Phase 6** admin.
6. **Phase 7** privileges.

Har phase ek separate turn me deliver hoga taaki aap test kar saken.

---

## Confirm karne wali cheezein

1. **Phases sequentially deliver karun (recommended), ya sab ek saath ek bare drop me?** Sequential se aap har step verify kar sakte hain aur token/credit bhi bachega.
2. **Assets:** procedural tier-based (11 base + per-level variation) OK hai, ya aap chahte hain main har level ke liye AI se separate Lottie/SVG generate karun (bohat mehnga + slow, but truly unique)?
3. **Existing 0052 trigger:** ye 1M-per-level formula use karta hai. Naya migration 0053 use replace karega non-linear thresholds ke saath + existing users ka level recompute karega (never-decrease guarantee ke saath). Confirm?

Aap "go" bolen to main **Phase 1 + 2** se start karta hun.