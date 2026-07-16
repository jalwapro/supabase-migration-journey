/**
 * AR overlay definitions + landmark-based drawing helpers.
 *
 * Anchored to MediaPipe FaceLandmarker landmark indices (478-point mesh):
 *   10  = forehead top-center
 *   152 = chin bottom
 *   234 = left face temple (viewer's right)
 *   454 = right face temple (viewer's left)
 *   1   = nose tip
 *
 * All draw functions accept normalized landmarks (0..1) + canvas dims, so
 * the same code runs for both the live CamProcessor and the /ar-test
 * static harness.
 */

import puppyPtr from "@/assets/ar/puppy-ears.png.asset.json";
import catPtr from "@/assets/ar/cat-ears.png.asset.json";
import bunnyPtr from "@/assets/ar/bunny-ears.png.asset.json";
import devilPtr from "@/assets/ar/devil-horns.png.asset.json";
import anglePtr from "@/assets/ar/angel-wings.png.asset.json";
import crownPtr from "@/assets/ar/golden-crown.png.asset.json";

export type OverlayAnchor = "head-top" | "forehead" | "behind";

export interface AROverlayDef {
  id: string;
  src: string;
  anchor: OverlayAnchor;
  /** width relative to face width (temple-to-temple) */
  widthScale: number;
  /** vertical shift as fraction of face height (negative = up) */
  offsetY: number;
}

export const AR_OVERLAYS: Record<string, AROverlayDef> = {
  puppy:          { id: "puppy",        src: puppyPtr.url, anchor: "head-top", widthScale: 1.6, offsetY: -0.55 },
  cat:            { id: "cat",          src: catPtr.url,   anchor: "head-top", widthScale: 1.4, offsetY: -0.45 },
  bunny:          { id: "bunny",        src: bunnyPtr.url, anchor: "head-top", widthScale: 1.2, offsetY: -0.9  },
  devil:          { id: "devil",        src: devilPtr.url, anchor: "forehead", widthScale: 1.5, offsetY: -0.35 },
  angel:          { id: "angel",        src: anglePtr.url, anchor: "behind",   widthScale: 3.2, offsetY:  0.1  },
  "golden-crown": { id: "golden-crown", src: crownPtr.url, anchor: "head-top", widthScale: 1.5, offsetY: -0.7  },
};

export function isAROverlayId(id: string): boolean {
  return id in AR_OVERLAYS;
}

/** Cached decoded overlay bitmaps. */
const bitmapCache = new Map<string, Promise<ImageBitmap | HTMLImageElement>>();

export function preloadOverlay(url: string): Promise<ImageBitmap | HTMLImageElement> {
  const cached = bitmapCache.get(url);
  if (cached) return cached;
  const p = (async () => {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error(`overlay fetch failed: ${res.status}`);
    const blob = await res.blob();
    if (typeof createImageBitmap === "function") {
      return await createImageBitmap(blob);
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = URL.createObjectURL(blob);
    await img.decode();
    return img;
  })().catch((e) => {
    bitmapCache.delete(url);
    throw e;
  });
  bitmapCache.set(url, p);
  return p;
}

export interface FacePose {
  /** normalized landmarks 0..1 (array indexed by MediaPipe indices) */
  landmarks: Array<{ x: number; y: number; z: number }>;
}

/**
 * Draw a single overlay onto `ctx` at the anchor computed from landmarks.
 * `canvasW/H` are the physical pixel dims of the target canvas.
 * `mirror` flips overlay horizontally when the video is mirrored (selfie).
 */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap | HTMLImageElement,
  def: AROverlayDef,
  pose: FacePose,
  canvasW: number,
  canvasH: number,
  mirror = false,
): void {
  const lm = pose.landmarks;
  if (!lm || lm.length < 468) return;

  const left = lm[234];    // right temple in image (viewer's left)
  const right = lm[454];   // left temple in image (viewer's right)
  const top = lm[10];      // forehead
  const chin = lm[152];    // chin

  // face box in canvas pixels
  const lx = left.x * canvasW;
  const rx = right.x * canvasW;
  const ty = top.y * canvasH;
  const cy = chin.y * canvasH;

  const faceW = Math.hypot(rx - lx, (right.y - left.y) * canvasH);
  const faceH = Math.abs(cy - ty);
  const cxFace = (lx + rx) / 2;
  const cyFace = (ty + cy) / 2;

  // roll angle (radians) — line between temples
  const roll = Math.atan2((right.y - left.y) * canvasH, rx - lx);

  const overlayW = faceW * def.widthScale;
  const aspect = bitmap.height / bitmap.width;
  const overlayH = overlayW * aspect;

  // anchor point (in un-rotated face frame)
  let anchorY = cyFace;
  if (def.anchor === "head-top") anchorY = ty + faceH * def.offsetY;
  else if (def.anchor === "forehead") anchorY = ty + faceH * def.offsetY;
  else if (def.anchor === "behind") anchorY = cyFace + faceH * def.offsetY;

  ctx.save();
  ctx.translate(cxFace, anchorY);
  ctx.rotate(roll);
  if (mirror) ctx.scale(-1, 1);
  ctx.drawImage(bitmap, -overlayW / 2, -overlayH / 2, overlayW, overlayH);
  ctx.restore();
}
