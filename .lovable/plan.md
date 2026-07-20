## Problem

Several pages (`/me`, `/rank`, `/u/$userId`, and a few others) were designed as always-dark neon canvases with hardcoded `bg-black`, `text-white`, `bg-white/[0.03]`, `border-white/10`. In light mode these become white-on-white and unreadable. Forcing a dark background on the whole page (what I just did to `/me`) hides light mode entirely — not what you want.

## Approach

Refactor each affected page to use **semantic tokens** so it auto-adapts to light/dark:

| Hardcoded (broken in light) | Replace with (auto-adapts) |
|---|---|
| `text-white` | `text-foreground` |
| `text-white/60`, `text-white/70` | `text-muted-foreground` |
| `bg-black`, `bg-black/40`, `bg-black/50` | `bg-card` or `bg-card/70` |
| `bg-white/[0.03]`, `bg-white/5` | `bg-card/60` |
| `border-white/10`, `border-white/15` | `border-border` |
| `ring-black/40` | `ring-border` |

Colored neon accents (icon glows, gradient chips, gold brackets, purple auras, drop-shadows) **stay as-is** — they're brand accents that work on both light and dark surfaces.

Remove the `bg-[#080212]` I added to `/me` and instead let the page use the app's `bg-background`. The dark neon *hero band* at the top stays (it's an intentional design element), but the *feature grid* below adopts semantic tokens.

## Pages to fix

1. **`src/routes/_authenticated/me.tsx`** — revert the forced black canvas; convert `FeatureCard`, `FeatureInner`, `StatBox`, `IconBtn`, `Quick`, `Chip` helpers to semantic tokens. Keep the neon profile card intact (it's a self-contained dark royal card, and that's fine — it's bounded, not the whole page).
2. **`src/routes/_authenticated/u.$userId.tsx`** — same treatment for the visitor profile.
3. **`src/routes/rank.tsx`** — leaderboard cards and rows to semantic tokens.
4. **Audit sweep**: `rg -l "text-white|bg-white/\[|bg-black"` across `src/routes/_authenticated/` and `src/components/` — for each hit, decide: is this on an always-dark surface (like a room camera, the profile card, a video panel)? Leave it. Otherwise convert to semantic tokens.

## Result

- Light mode: white app, white cards with dark text, subtle borders — clean and readable everywhere.
- Dark mode: unchanged from today.
- The neon profile card on `/me` stays a bounded dark "royal" element inside the page, contrasted against a light or dark app surface depending on user's setting.
- Same fix pattern applied to rank, visitor profile, and any other page found in the sweep.

## Technical details

- No changes to `src/styles.css` tokens — they're already correct.
- Pure Tailwind class swaps; no logic changes.
- Semantic tokens I'll use: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `text-[color:var(--primary)]`, `text-[color:var(--gold)]`.
- The `body.themed` header softening (dark blur bar over shop-theme backgrounds) stays — it's independent of this.
