
## Problems

**1. Gifts sirf static PNG dikhate hain, animation nahi chalti**
Abhi jo starter25/luxury25 gifts insert kiye hain wo transparent PNG hain. `GiftAnimationPlayer.tsx` MP4 / SVGA / SVG / image sab support karta hai — lekin PNG ke liye sirf image render hota hai, koi motion nahi. TikTok jese real animated gifts ke liye **SVGA** ya **MP4 with alpha** files chahiye — PNG me animation possible nahi.

**2. Seat request pe host user ko pick nahi kar pata**
Backend RPCs (`request_seat`, `respond_seat_request`) sahi hain aur RLS/realtime bhi enabled hain. Popup component bhi maujood hai. Bug possibly:
- Multiple pending requests aayen to naya request purane ko overwrite karta hai (koi queue nahi)
- Host reload kare aur > 1 pending ho to `maybeSingle()` sirf ek dikhata hai
- Agar accept ke waqt seat meanwhile fill ho gaya to "seat already taken" throw hota hai — user ko clear feedback nahi

## Plan

### Part A — Real Animated Gifts (SVGA pipeline)
1. **Free SVGA library use karo** — TikTok/Bigo/PocoLive style gifts ke SVGA files public repos (e.g., `svga-samples`) se pull karo. Ye already `SvgaPlayer.tsx` me supported hai.
2. `scripts/fetch-svga-pack.mjs` banao jo:
   - Curated 30-50 SVGA URLs download kare `public/animations/gifts/svga/` me
   - Har gift ka `name`, `price`, `diamonds`, `svga path` metadata generate kare
3. **Migration `0174_gifts_svga_animated.sql`** — 30 real animated SVGA gifts insert karo (Rose Rain, Sports Car, Universe, Lion, Dragon, Castle, etc.) with `clip_path` pointing to `.svga` and `clip_type='svga'`.
4. Purane static PNG-only gifts ko `is_active=false` kar do (starter25/luxury25 dono) taake sirf animated wale sheet me aayen.
5. `GiftSheet.tsx` verify — preview me thumbnail dikhaye, tap pe SVGA play ho.

### Part B — Seat Pick Fix
1. `pendingSeatRequest` ko **array** banao instead of single object → queue system. Naya request aaye to append, popup FIFO order me show kare.
2. Initial load me `.limit(10)` karke saari pending requests fetch karo.
3. Popup me "Pending: 2 more" badge dikhao agar queue > 1.
4. Accept fail ho (seat taken race) to popup se remove karke agla request auto-show karo with error toast.
5. Host ke liye header me **red badge** with pending count taake dikhta rahe even if popup band kiya.

## Files to Edit
- `scripts/fetch-svga-pack.mjs` (new)
- `db/migrations/0174_gifts_svga_animated.sql` (new)
- `db/migrations/0175_deactivate_static_gifts.sql` (new)
- `src/routes/room.$roomId.tsx` — pendingSeatRequest → queue, badge in header
- `src/routes/room.$roomId.tsx` SeatRequestPopup — show queue count

## Confirm Karo
- **SVGA source**: kya main free public SVGA gifts (github.com/svga/SVGA-Samples type) use kar sakta hoon? Ye TikTok jese hi animated hain but original 3rd-party assets. Ya aap chahte ho custom MP4 with alpha channel gifts banaun (slower + costly)?
- **Static PNG gifts hata dun** ya animated ke saath dono rakhun?
