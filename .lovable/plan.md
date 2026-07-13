
## Goal

Camera pe **face stickers** (glasses, crown, kaan, mustache, dil), **beauty filter**, **background blur** aur **background replace** — sab live process ho aur **sab viewers ko broadcast** ho, sirf apni screen tak limited nahi.

## Approach (Technical)

**Libraries (free, browser-native, no API cost):**
- `@mediapipe/tasks-vision` — Google ka WASM SDK
  - `FaceLandmarker` — 468 face landmarks + blendshapes (60fps mobile)
  - `ImageSegmenter` (selfie model) — person vs background mask
- Canvas 2D — sticker draw + composite
- `canvas.captureStream(30)` → processed MediaStream
- Zego custom video source: `ZegoExpressEngine.createZegoStream({ camera: { videoSource: <MediaStreamTrack> } })` — camera ki jagah processed track publish hoga

**Pipeline (har frame ~30fps):**
```
raw camera video → hidden <video>
   ↓
canvas draw:
  1. segmentation mask nikaalo
  2. background layer (blur / image / original)
  3. person layer (mask ke andar) — beauty smooth agar on ho
  4. face landmarks se stickers draw (glasses eyes pe, crown forehead pe, etc.)
   ↓
canvas.captureStream() → Zego custom stream → sab viewers dekhein
```

**Beauty filter:** person layer par halka bilateral-style blur (canvas filter `blur(1px)` + `contrast(1.05) saturate(1.1)`), lips/eyes region par sharp overlay. Simple approach — heavy GPU shader nahi.

**Sticker positioning:** FaceLandmarker deta hai forehead (10), eyes (33, 263), nose (1), lips (13). Har sticker ka anchor + scale rule (e.g. glasses = eyes ke beech, width = eye distance × 2.5).

## Files to Create

1. `src/lib/camPipeline/mediapipe.ts`
   - Singleton loaders: `getFaceLandmarker()`, `getSegmenter()` (init WASM once, cache)
   - Model URLs (Google CDN, no download needed)

2. `src/lib/camPipeline/CamProcessor.ts`
   - Class jo raw `MediaStream` leti hai + config (`{ background, sticker, beauty }`)
   - Internal: `<video>` + `<canvas>` + rAF loop
   - Methods: `start()`, `stop()`, `updateConfig()`, `getOutputStream(): MediaStream`
   - Har frame: segment → draw bg → draw person → draw stickers

3. `src/lib/camPipeline/stickers.ts`
   - 8-10 sticker definitions: `{ id, label, emoji, imageUrl, anchor: 'eyes'|'forehead'|'nose'|'mouth', scale, offsetY }`
   - Stickers: 🕶️ sunglasses, 👑 crown, 🐰 bunny ears, 🐱 cat ears+nose, 👹 devil horns, 🥸 mustache+glasses, 💕 floating hearts, ✨ sparkles, 🌸 flower crown, 🎩 top hat

4. `src/lib/camPipeline/backgrounds.ts`
   - 12 preset background configs: `{ id, label, type: 'none'|'blur'|'image', url? }`
   - Presets: None, Blur, Beach, Sunset, Galaxy, Neon City, Luxury Room, Cafe, Studio Pink, Forest, Snow, Gradient Purple

5. `src/components/room/CamStudio.tsx` (existing filter sheet replace)
   - Bottom sheet with 3 tabs: **Face** (stickers) | **Background** (blur/presets/upload) | **Beauty** (toggle + intensity slider)
   - Grid of thumbnails with live preview highlight
   - Upload background: `<input type="file" accept="image/*">` → object URL (per-user, local only, no storage)

6. `src/hooks/useCamPipeline.ts`
   - Context provider (like existing CamFilter)
   - State: `{ stickerId, backgroundId, customBgUrl, beautyOn, beautyIntensity }`
   - Wraps `CamProcessor`, gives `processedStream` to Zego publisher
   - Persist choices in `localStorage` per-user

7. `src/assets/stickers/` — 10 PNG stickers (generate via imagegen, transparent bg)

8. `src/assets/backgrounds/` — 12 background images (1280x720, generate via imagegen)

## Files to Edit

1. `src/hooks/useZegoRoom.ts` — `toggleVideo(true)` me: agar `useCamPipeline` se `processedStream` mile to us track ko `createZegoStream` custom source ke tor pe do; warna current path (raw camera). New param: `videoSource?: MediaStreamTrack`.

2. `src/routes/room.$roomId.tsx` — 
   - `CamFilterProvider` → `CamPipelineProvider` swap
   - Existing `CamFilterSheet` → `CamStudio`
   - Sparkles button same, sheet ke tabs zyada
   - Pipeline output track pass to `useZegoRoom`

3. `src/components/room/CamFilter.tsx` — deprecate (delete) ya keep as CSS-only fallback for very old devices. Delete karunga; naya system replace karega.

## Performance & UX

- MediaPipe models sirf tab load hon jab user camera on kare (lazy import + WASM ~4MB, one-time)
- Frame rate cap 24fps if device thermally throttles (detect via frame time)
- Segmentation model: MediaPipe SelfieSegmenter general model (fast, mobile-friendly)
- Beauty intensity slider 0-100, off by default
- "None" sticker + "None" background = pipeline bypass (raw stream direct) → zero overhead

## Not in Scope (this pass)

- Custom sticker upload (later)
- Face swap / deepfake
- 3D stickers (only 2D PNG overlays)
- Broadcasting beauty via GPU shader (using canvas filter, "good enough" on mobile)

## Order of Work

1. Install `@mediapipe/tasks-vision`
2. Generate sticker + background assets (parallel imagegen calls)
3. Build `CamProcessor` + mediapipe loaders
4. Build hook + provider
5. Build `CamStudio` UI (3 tabs)
6. Wire into `useZegoRoom` custom video source
7. Replace old filter sheet in room route
8. Test: camera on → filter apply → check dusray viewer ki screen pe dikh raha hai

Confirm karo — build shuru kar doon?
