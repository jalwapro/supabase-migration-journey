# PK Match Feature

Reference image ke mutabiq ek complete PK (Player Knockout) battle system banayenge — layout, UI, aur backend sab.

## New Route
`src/routes/pk.$roomId.tsx` — Full PK setup + live battle screen.

## UI Layout (reference image ke exact match)

```text
┌────────────────────────────────────┐
│ ← Chill Vibes ✨   [Follow] [⋮]   │
│   Room ID • 128 viewers            │
├────────────────────────────────────┤
│ 📢 Welcome banner                  │
├────────────────────────────────────┤
│ ┌────────┐   VS    ┌────────┐     │
│ │YOU(HOST│  00:30  │OPPONENT│     │
│ │  img   │ PK Rules│  + Sel │     │
│ │ Ahsan  │         │  ---   │     │
│ │ 12.5K  │         │        │     │
│ └────────┘         └────────┘     │
├────────────────────────────────────┤
│ PK MODE                            │
│ [Normal 5m ✓][Quick 3m][Chall 10m]│
├────────────────────────────────────┤
│ STAKE (Entry)                      │
│ [100][500][1k][5k][Custom]        │
├────────────────────────────────────┤
│ 🎁 Winner gets stakes + gifts     │
├────────────────────────────────────┤
│ [   START PK BATTLE  ⚡          ] │
├────────────────────────────────────┤
│ Chat  [All][Gifts][System][filter] │
│ ...messages...                     │
│ Top Gifter highlight               │
│ [Type msg...] 😊 ➤                │
├────────────────────────────────────┤
│ Mic Sound Gift Share More  ✋Raise│
└────────────────────────────────────┘
```

## Features

1. **Setup phase** (host only):
   - PK Mode select (Normal 5m / Quick 3m / Challenge 10m)
   - Stake select (100/500/1k/5k coins + Custom input)
   - Opponent picker sheet (search live hosts, tap to invite)
   - PK Rules bottom sheet
   - Start button → creates `pk_matches` row, sends invite

2. **Live battle phase**:
   - Countdown timer (match starts in 00:30)
   - Live coin totals for both sides (from gifts sent during match)
   - Progress bar showing lead
   - Chat sidebar with All/Gifts/System filters
   - Top Gifter callout row
   - Gift → adds to that side's coin total

3. **Result phase**:
   - Winner banner + coin payout
   - Losers get consolation
   - Match saved to history

## Backend (Supabase migration)

`db/migrations/20260716_pk_matches.sql`:

- `pk_mode` enum: `normal | quick | challenge`
- `pk_status` enum: `pending | active | completed | cancelled`
- `pk_matches` table: id, host_id, opponent_id, mode, stake_coins, host_score, opponent_score, winner_id, status, started_at, ends_at, created_at
- `pk_match_gifts` table: id, match_id, sender_id, recipient_id, gift_id, coins, created_at
- Indexes on host_id, opponent_id, status, ends_at
- RLS: authenticated read; only host creates; only participants + admin update scores via edge logic
- GRANTs to authenticated + service_role
- Realtime enabled on both tables

## Server functions

`src/lib/pk-matches.functions.ts` (with `requireSupabaseAuth`):
- `createPkMatch({ mode, stake, opponentId })`
- `acceptPkMatch({ matchId })` / `declinePkMatch`
- `sendPkGift({ matchId, recipientId, giftId, coins })` — deducts sender coins, adds to score
- `endPkMatch({ matchId })` — computes winner, credits payout
- `listActivePkMatches()`, `getPkMatch(id)`

## Frontend wiring
- React Query for match state
- Supabase realtime channel for `pk_matches:id=eq.<id>` and gift inserts
- Existing gold/violet tokens from voice room design (Royal Violet Palace)
- Reuse existing components: viewers sheet, gift sheet, chat feed

## Entry point
Add a "PK Battle" tile on the room screen (`src/routes/room.$roomId.tsx`) header actions — tap navigates to `/pk/<roomId>`.

## Scale
- Paginate match history
- Filter realtime by match id only
- Indexes on all query columns
- Server-side score aggregation, no client trust
