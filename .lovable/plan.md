# Real AR Face-Mesh Overlays (MediaPipe + Canvas Compositing)

Broadcaster ke camera pe har frame face-landmark detect karke transparent PNG overlays (puppy ears, crown, horns, wings, etc.) attach karega. Composited stream Zego pe publish hoga, so viewers ko already-rendered video milega — koi extra CPU nahi.

## Architecture

```text
raw camera stream
   │
   ▼
CamProcessor (canvas 2D, 30 fps)
   │  1. draw src video with ctx.filter tint (existing)
   │  2. every 2nd frame → FaceLandmarker.detectForVideo() → 478 landmarks
   │  3. per active AR preset → drawImage(overlayPNG) anchored on landmarks
   │  4. canvas.captureStream() → Zego publish
   ▼
output MediaStream
```

## Overlay definitions

Har AR preset ke sath aik `AROverlay` object:

```ts
interface AROverlay {
  id: string;          // matches FilterPreset.id
  src: string;         // .asset.json url
  anchor: "head" | "forehead" | "nose" | "mouth" | "eyes" | "full-face" | "behind";
  scaleFactor: number; // relative to face bounding box width
  offsetY: number;     // fine tune in face-height units
}
```

Landmark anchors use MediaPipe FaceLandmarker indices:
- head top: 10, chin: 152, temples: 234/454 → derive face box + tilt angle
- forehead center: 10, nose tip: 1, mouth center: 13
- eye centers: 468 (left iris), 473 (right iris)

## Assets (20 transparent PNGs via `imagegen`)

Batch generate karunga `src/assets/ar/` mein, phir `lovable-assets create` se CDN pe move:

**Funny (10):** puppy-ears, cat-ears+whiskers, bunny-ears, panda-ears+patches, monkey-ears, dino-scales, alien-eyes, fat-cheeks (semi-transparent tint), tiny-face-frame, big-eyes-overlay

**AR (10):** butterflies (animated sprite sheet, 4 frames), angel-wings+halo, devil-horns, fire-aura (looping sprite), ice-crown+snowflakes, galaxy-bg (behind-user, needs selfie-segmentation), magic-runes (rotating), laser-eyes (procedural — draw beams from eye landmarks, no PNG), neon-rgb-frame, golden-crown

Notes:
- `galaxy` — uses existing `ImageSegmenter` (already in `mediapipe.ts`) to swap background
- `laser-eyes`, `fire-aura`, `magic-runes` — procedural canvas draw + PNG, animated via `performance.now()`
- Butterflies — sprite atlas cycled per frame

## Files to create/change

- **NEW** `src/lib/camPipeline/arOverlays.ts` — 20 overlay defs + `preloadOverlays()` + `drawOverlay(ctx, landmarks, def, tMs)`
- **NEW** `src/lib/camPipeline/faceTracker.ts` — throttled FaceLandmarker wrapper, computes face box + roll angle from landmarks
- **NEW** `src/assets/ar/*.png.asset.json` — 15-18 transparent overlay pointers (procedural ones don't need PNGs)
- **EDIT** `src/lib/camPipeline/CamProcessor.ts` — add face tracking + overlay compositing in `drawFrame()`; keep existing tint path unchanged; auto-skip tracking when active preset is not in AR/funny category (zero overhead)
- **EDIT** `src/lib/camPipeline/filters.ts` — for AR/funny presets, replace CSS filter with a marker so CamProcessor knows to load overlay instead of tint (or keep tint AND overlay for combo look)
- **EDIT** `src/hooks/useCamPipeline.tsx` — call `preloadOverlays()` after processor start

## Performance guardrails

- FaceLandmarker runs every **2nd frame** (~15 Hz), interpolate landmarks between frames
- Overlays only load lazily on first use (per-preset PNG fetch)
- If FaceLandmarker init fails (WASM CDN blocked, low-end device) → fallback to existing CSS tint only, log warning, don't crash
- All PNGs pre-decoded to `ImageBitmap` (GPU-friendly on Chromium)
- Total added weight: ~2 MB WASM (already cached from mediapipe.ts if used) + ~1.5 MB of overlay PNGs (loaded on demand)

## Delivery in this turn

Given the scope (20 asset generations, 3 new files, MediaPipe wiring), aik hi turn mein:
1. Foundation likhunga: `faceTracker.ts`, `arOverlays.ts`, CamProcessor edits, useCamPipeline preload
2. Pehli 5 AR PNGs generate karunga (puppy, cat, bunny, angel-wings, golden-crown) + laser-eyes procedural
3. Baaki 14 overlays ko "coming soon" mark karunga; agli turn mein aap ke feedback ke baad batch generate karunga

Ye is liye kyunki 20 alag `imagegen` calls + 20 `lovable-assets create` uploads ek turn mein bohat time lega aur agar aap ko koi asset pasand nahi to sab ko regenerate karna parega. Pehle 5 se style/quality validate karlein, phir baaki 15 batch mein.

## Out of scope

- Face tracking on viewers' devices (broadcaster-side only per aap ke decision)
- Sound effects (bark/meow/roar) — separate feature, agli iteration
- Real physics (ears bouncing with head movement) — v2

Approve karne ke baad implementation start.
