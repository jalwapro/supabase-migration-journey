## Voice Room — Multi-part Upgrade Plan

Aap ne 8 changes maange hain. Yeh plan har ek ko cover karta hai.

### 1. Viewer count → Viewers popup
- Header ka viewer count clickable → bottom sheet khulega
- List me sirf **viewers** (jo seat pe nahi hain) with dp + frame + name
- Agar current user **host ya moderator** hai → har viewer row pe **"Invite to seat"** button
- Click karne pe DB me `seat_invites` row insert hoti hai (naya table)

### 2. Seat invite → viewer accept popup
- Naya table `seat_invites (id, room_id, from_user, to_user, seat_index NULL, status, created_at)`
- Realtime subscribe: jab viewer ko invite aaye → modal popup "Host aap ko seat pe bula raha hai — Accept / Decline"
- Accept → auto seat pe baith jata hai (first free seat, ya nominated seat_index)

### 3. Seat lock by host/moderator
- Har seat ke long-press / manage sheet me **"Lock seat"** toggle (host + moderator only)
- New column `room_seats.locked` (ya `live_rooms.locked_seats jsonb`) — chhota table `room_seat_locks(room_id, seat_index, locked_by)` cleaner
- Locked seat pe koi apply nahi kar sakta

### 4. Points sirf gifting se, DP tap se nahi
- Current: DP press → like/point increment
- Change: DP tap handler se popularity/like RPC hata do
- `send_room_gift` already popularity + diamonds update karta hai — verify

### 5. Gifts → diamonds to receiver
- `send_room_gift` mein already `diamonds_earned = price * hostGiftShare` hota hai aur `profiles.diamonds` me add hota hai
- Verify wallet screen mein "Diamonds" tab dikhata hai — agar nahi, add

### 6. Host seat rules
- Seat 0 = host-only (already convention)
- Enforce: 
  - Sirf host `seat_index = 0` claim kar sakta hai (RLS + client check)
  - Agar host koi aur seat pe jaye → seat 0 automatically khali (server-side trigger ya client cleanup)
  - Host wapas aana chahe to seat 0 hamesha reserved
- Client: dusri seat pe "Sit here" tab pe host ke case me pehle seat 0 se hata do

### 7. Seats me sirf DP + frame, name hide
- Current SeatTile me username text hai — remove kar do
- DP + equipped avatar frame render karo, username sirf manage sheet me

### 8. Emoji reaction bar — user count hatao, seated user DPs dikhao
- Current: emoji picker ke saath viewer count badge
- Change: horizontal strip of seated members' DPs (jaise gift box mein hota hai)
- Jese-jese seat fill ho, DP add hota jaye

### 9. Gift box redesign
- Existing `GiftSheet` me receiver row already hai; refactor:
  - DP-based avatar chips (name hataao, sirf DP + frame)
  - **"All"** chip + har seated user ka DP chip
  - Multi-select ya single toggle (default single; "All" broadcasts)

---

### Files to change
- `db/migrations/0033_seat_invites_and_locks.sql` — naya migration (seat_invites table + seat_locks column + RLS)
- `src/routes/room.$roomId.tsx` — SeatTile, ViewersSheet, InviteAcceptModal, emoji bar, DP-tap handler
- `src/components/GiftSheet.tsx` — receiver chips redesign
- `src/hooks/useRealtimeInvalidate.ts` ya inline realtime for `seat_invites`

### Order of work
1. SQL migration (aap apply karo ge Supabase pe)
2. Points-from-DP-tap remove (chhota, safe)
3. Seat rules + seat 0 host-only enforcement
4. SeatTile — hide name, DP-only
5. Emoji bar → seated DP strip
6. Viewers sheet + invite flow (biggest piece)
7. Seat lock UI
8. GiftSheet receiver chip redesign

### Confirm before I start
- Migration file main likhu — aap khud Supabase pe apply karo ge (per your Core rule)?
- Seat 0 = host convention theek hai, ya aap chahtay ho host ke liye alag "host chair" upar center?
- Invite accept popup timeout (e.g. 30s auto-decline) chahiye?