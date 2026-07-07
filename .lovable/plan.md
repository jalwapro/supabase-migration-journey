# Full Port: jalwa1-main → current project

Reference zip has **55+ routes**, **30 SQL migrations**, full admin panel, VIP, PK battles, partner program, theme shop, splash, etc. Ye ek turn mein possible nahi — phases mein karna hoga taake har phase compile ho, test ho, aur aap review kar sako.

## Approach

Ref project already Lovable Cloud (Supabase) use karta hai. Hum uske migrations replay karenge (existing tables merge honge) aur routes ko `src/routes/` mein copy karenge phase-by-phase.

## Phases

### Phase A — DB foundation (schema port)
- 30 reference migrations ko is project ke Lovable Cloud pe apply karna (conflicting tables ke liye `IF NOT EXISTS` / merge)
- Grants + RLS policies verify
- `src/integrations/supabase/types.ts` regenerate

### Phase B — Core user routes
- `splash`, `onboarding`, `auth`, `reset-password`, `profile`, `settings`, `wallet`, `withdraw`, `rank`, `vip`, `theme-shop`, `gallery`, `partner`, `blocked-users`, `friends`, `inbox`, `chat.$uid`, `user.$uid`, `live-history`, `pk-history`, `privacy-policy`
- Har route ke supporting components + hooks port

### Phase C — Live/Room stack
- `room.tsx`, `room.$id.tsx` (replace current `room.$roomId`)
- Agora integration + PK battle + gifts + room backgrounds

### Phase D — Games
- `games.tsx` (lucky spin + others jo ref mein hain)

### Phase E — Admin panel (26 sub-routes)
- `admin.tsx` shell + all `admin.*` children:
  users, rooms, live, gifts, vip, pk, rankings, recharge, withdrawals, reports, support, logs, settings, cms, ads, banners, splash, themes, theme-categories, room-backgrounds, roles, accounts, free-accounts, partners, integrations, economy, finance-reports, profile-admin
- Admin guard via `has_role('admin')`

### Phase F — Polish
- Nav/layout updates for new routes
- Capacitor config check (already done)
- Publish

## Technical notes
- Reference uses `.tsx` extension in `src/routes/` — current project same convention
- Migration numbering: ref uses timestamps `2026070...`; hum bhi wahi timestamps use karenge to avoid collision with existing `0001–0005`
- Existing project ke routes (jaisa current `wallet.tsx`, `admin.tsx`, `room.$roomId.tsx`) — ref versions se **replace** honge (aap ne "pura port" kaha hai)
- Assets (images, logos) ref se copy honge

## Aaj is turn mein: Phase A only
Bara scope hai — main abhi Phase A (DB migrations port + types regen) start karta hoon. Phir aap `next` bolo to Phase B, etc.

Confirm karein ya changes suggest karein.