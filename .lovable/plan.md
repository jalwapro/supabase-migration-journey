# Premium Profile Card System

End-to-end profile-card cosmetics: shop → purchase (coins/diamonds) → equip → auto-render on every profile view, with an admin catalog.

## 1. Database — migration `0256_profile_cards.sql`

- `profile_cards` — catalog: `id, key, name, description, category, rarity, bg_media_url, bg_media_type` (image/video/lottie/svga/builtin), `bg_chromakey, thumbnail_url, frame_effect, accent_color, glow_color, particle_style, price_coins, price_diamonds, min_vip_level, duration_days` (null = permanent), `is_active, is_limited, starts_at, ends_at, sort_order`.
- `user_profile_cards` — ownership: `user_id, card_id, purchased_at, expires_at, is_equipped` (unique partial index for one equipped per user).
- RPCs (SECURITY DEFINER, wallet-atomic): `purchase_profile_card(card_id, currency)`, `equip_profile_card(card_id)`, `unequip_profile_card()`, `admin_upsert_profile_card(...)`, `admin_delete_profile_card(id)`.
- GRANTs + RLS: catalog readable by anon; ownership readable by anyone (so viewers can render the owner's equipped card); write RPCs gated by owner or `has_role('admin')`.
- Seed ~45 cards across all 9 categories (Basic, VIP, Royal, Luxury, Fantasy, Galaxy, Nature, Neon, Event) using `builtin:` keys resolved to pure-SVG animated backgrounds — populated on day one, no media upload needed.

## 2. Playback / rendering

- **`src/lib/profileCards/registry.ts`** — resolves a card's background (image/video/lottie/svga/builtin), frame effect, accent + glow colors, particle style.
- **`src/lib/profileCards/builtin.tsx`** — 45 pure-SVG animated backgrounds (gradient shine, aurora, sakura fall, nebula drift, matrix rain, phoenix flames, dragon scales, etc.).
- **`src/components/profile/PremiumProfileCard.tsx`** — reusable card shell:
  - Animated background layer (respects chromakey for MP4/WebM)
  - Glassmorphism content panel with slide-in + border-glow keyframes
  - `LevelAvatar` (uses equipped avatar frame + VIP tier)
  - Slots: username, ID, country flag, VIP badge, level, verified check, popularity, followers/following/friends, bio, online status, join date, signature
  - Floating particles/sparkles layer per `particle_style`
  - Action row: Follow, Message, Voice, Video, Invite, Gift, Report, Block, Share
  - Respects `prefers-reduced-motion`
- Wired into `src/routes/_authenticated/u.$userId.tsx` (visitor profile) and `me.tsx` preview — the card wraps the existing hero, replacing the current static hero background.

## 3. Shop — `src/routes/_authenticated/shop-profile-cards.tsx`

- Category tabs (all 9), search bar, rarity filter.
- Grid of cards, each: live mini preview, name, rarity chip, coin + diamond price, VIP requirement, duration badge, status chip (Owned / Equipped / Locked).
- Tap → fullscreen preview modal with the real `PremiumProfileCard` populated with the viewer's data, plus Purchase (coins/diamonds toggle) + Equip buttons.
- Added to existing Shop nav alongside Frames/Entrances/etc.

## 4. Admin panel — `src/routes/_authenticated/admin.profile-cards.tsx`

- CRUD grid with edit / toggle-active / delete + owned-count stats.
- Upload background (image/mp4/webm/lottie/svga) + thumbnail via existing `FileUploader` → `shop-assets/profile-cards/`.
- Fields: name, description, category, rarity, chromakey, price (coins + diamonds), min VIP, duration, limited-time window, accent + glow color pickers, particle style.
- Sidebar link added to `AdminShell` under "Shop".

## 5. Design language

Reuses existing tokens (`--gold`, `--primary`, `--secondary`), glassmorphism (`backdrop-blur-xl`, `bg-white/[0.03]`), gold ornaments from `JalwaFrame`. All new keyframes live in `src/styles.css`.

## Out of scope this turn

- Recording real cinematic MP4 backgrounds — the seed uses premium animated SVG backgrounds. Admin can upload real videos any time; playback path handles them from day one.
- Voice/Video call wiring — action buttons route to existing DM/call flows already in the app.

## Ready to build?
Confirm and I'll ship the migration + all files above in one pass.
