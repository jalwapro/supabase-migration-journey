/**
 * Advanced Gift Rendering config — the single source of truth for every
 * admin-controlled visual parameter of a gift clip. Stored per gift in
 * `gifts.render_config` (jsonb) and snapshotted onto `gift_sends`.
 */

export type GiftFitMode = "contain" | "cover" | "fill" | "original" | "stretch";
export type GiftLayer =
  | "behind-user"
  | "behind-chat"
  | "center"
  | "above-user"
  | "fullscreen"
  | "top";
export type GiftAnchor =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "custom";
export type ChromaMode = "off" | "green" | "blue" | "black" | "white" | "auto";

export interface GiftRenderConfig {
  // --- size ---
  width: number | null;   // px, null = auto (fill slot)
  height: number | null;  // px
  scale: number;
  scaleX: number;
  scaleY: number;
  fit: GiftFitMode;

  // --- position ---
  positionX: number; // px offset from anchor
  positionY: number;
  anchor: GiftAnchor;
  layer: GiftLayer;
  priority: number;
  safeAreaTop: number;    // % insets that content must respect
  safeAreaBottom: number;
  safeAreaLeft: number;
  safeAreaRight: number;

  // --- transform ---
  rotation: number; // -180..180
  flipH: boolean;
  flipV: boolean;
  zoom: number; // 0.5..3
  opacity: number; // 0..100

  // --- crop (px of the source frame) ---
  cropTop: number;
  cropBottom: number;
  cropLeft: number;
  cropRight: number;

  // --- mask blur ---
  blurTop: number;    // % of height affected
  blurBottom: number;
  blurLeft: number;   // % of width
  blurRight: number;
  blurRadius: number; // 0..100
  blurFeather: number; // 0..100 gradient softness

  // --- color correction ---
  brightness: number;  // -100..100
  contrast: number;    // -100..100
  saturation: number;  // 0..2
  temperature: number; // -100..100
  tint: number;        // -100..100
  highlights: number;  // -100..100
  shadows: number;     // -100..100
  exposure: number;    // -100..100
  gamma: number;       // 0.2..3
  hue: number;         // -180..180
  sharpness: number;   // 0..100
  denoise: number;     // 0..100

  // --- chroma key ---
  chromaMode: ChromaMode;
  keyColor: string;        // hex, used when mode is a screen colour
  greenTolerance: number;  // 0..100
  edgeSoftness: number;    // 0..100
  spillSuppression: number;// 0..100
  shadowProtection: number;// 0..100
  colorRecovery: number;   // 0..100 (restores edge colour after keying)
  contrastRecovery: number;// 0..100
  edgeCleanup: number;     // 0..100 (alpha erode/choke)

  // --- position units ---
  /**
   * "percent" (recommended) → positionX/Y are a % of the playback stage, so a
   * gift lands in the same spot on phone, tablet and desktop.
   * "px" → legacy absolute offsets (kept for already-configured gifts).
   */
  positionUnit: "px" | "percent";

  // --- timing ---
  delayMs: number;
  holdMs: number;      // extra time the last frame is held on screen
  endMs: number | null; // hard cut-off; null = clip length
  loop: boolean;
  loopCount: number;   // 0 = infinite while visible
}


export const DEFAULT_GIFT_RENDER: GiftRenderConfig = {
  width: null,
  height: null,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  fit: "contain",

  positionX: 0,
  positionY: 0,
  anchor: "center",
  layer: "fullscreen",
  priority: 0,
  safeAreaTop: 0,
  safeAreaBottom: 0,
  safeAreaLeft: 0,
  safeAreaRight: 0,

  rotation: 0,
  flipH: false,
  flipV: false,
  zoom: 1,
  opacity: 100,

  cropTop: 0,
  cropBottom: 0,
  cropLeft: 0,
  cropRight: 0,

  blurTop: 0,
  blurBottom: 0,
  blurLeft: 0,
  blurRight: 0,
  blurRadius: 0,
  blurFeather: 40,

  brightness: 0,
  contrast: 0,
  saturation: 1,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  exposure: 0,
  gamma: 1,
  hue: 0,
  sharpness: 0,
  denoise: 0,

  chromaMode: "auto",
  keyColor: "#00ff00",
  greenTolerance: 35,
  edgeSoftness: 12,
  spillSuppression: 65,
  shadowProtection: 10,
  colorRecovery: 60,
  contrastRecovery: 0,
  edgeCleanup: 8,

  positionUnit: "px",
  delayMs: 0,
  holdMs: 0,
  endMs: null,
  loop: false,
  loopCount: 0,
};


/** Merge a partial/unknown jsonb blob onto the defaults, coercing types. */
export function normalizeRenderConfig(raw: unknown): GiftRenderConfig {
  const out: GiftRenderConfig = { ...DEFAULT_GIFT_RENDER };
  if (!raw || typeof raw !== "object") return out;
  const src = raw as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_GIFT_RENDER) as (keyof GiftRenderConfig)[]) {
    const v = src[key];
    if (v === undefined) continue;
    const def = DEFAULT_GIFT_RENDER[key];
    if (typeof def === "boolean") (out[key] as boolean) = Boolean(v);
    else if (typeof def === "string") (out[key] as string) = String(v);
    else if (v === null) (out[key] as unknown) = null;
    else if (typeof v === "number" && Number.isFinite(v)) (out[key] as number) = v;
    else if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) (out[key] as number) = Number(v);
  }
  return out;
}

/** Only persist values that differ from the defaults — keeps rows small. */
export function diffRenderConfig(cfg: GiftRenderConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_GIFT_RENDER) as (keyof GiftRenderConfig)[]) {
    if (cfg[key] !== DEFAULT_GIFT_RENDER[key]) out[key] = cfg[key];
  }
  return out;
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 1, 0];
  const n = parseInt(m[1]!, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export const LAYER_Z: Record<GiftLayer, number> = {
  "behind-user": 5,
  "behind-chat": 30,
  center: 90,
  "above-user": 110,
  fullscreen: 120,
  top: 200,
};

/** CSS box + transform for the gift container derived from the config. */
export function renderConfigToStyle(cfg: GiftRenderConfig): React.CSSProperties {
  const anchorStyle: React.CSSProperties = {};
  const a = cfg.anchor;
  if (a === "center" || a === "custom") {
    anchorStyle.top = "50%";
    anchorStyle.left = "50%";
  } else {
    if (a.includes("top")) anchorStyle.top = 0;
    else if (a.includes("bottom")) anchorStyle.bottom = 0;
    else anchorStyle.top = "50%";
    if (a.includes("left")) anchorStyle.left = 0;
    else if (a.includes("right")) anchorStyle.right = 0;
    else anchorStyle.left = "50%";
  }

  const centerX = anchorStyle.left === "50%";
  const centerY = anchorStyle.top === "50%";

  // Percent mode keeps a gift in the same relative spot on every screen size:
  // the offset is applied to the anchor edges as a % of the playback stage.
  const percent = cfg.positionUnit === "percent";
  if (percent) {
    const x = cfg.positionX;
    const y = cfg.positionY;
    if (centerX) anchorStyle.left = `calc(50% + ${x}%)`;
    else if (anchorStyle.left === 0) anchorStyle.left = `${x}%`;
    else if (anchorStyle.right === 0) anchorStyle.right = `${-x}%`;
    if (centerY) anchorStyle.top = `calc(50% + ${y}%)`;
    else if (anchorStyle.top === 0) anchorStyle.top = `${y}%`;
    else if (anchorStyle.bottom === 0) anchorStyle.bottom = `${-y}%`;
  }

  const parts: string[] = [];
  if (centerX || centerY) parts.push(`translate(${centerX ? "-50%" : "0"}, ${centerY ? "-50%" : "0"})`);
  if (!percent) parts.push(`translate3d(${cfg.positionX}px, ${cfg.positionY}px, 0)`);

  if (cfg.rotation) parts.push(`rotate(${cfg.rotation}deg)`);
  const sx = cfg.scale * cfg.scaleX * cfg.zoom * (cfg.flipH ? -1 : 1);
  const sy = cfg.scale * cfg.scaleY * cfg.zoom * (cfg.flipV ? -1 : 1);
  parts.push(`scale(${sx}, ${sy})`);

  return {
    position: "absolute",
    ...anchorStyle,
    width: cfg.width ? `${cfg.width}px` : "100%",
    height: cfg.height ? `${cfg.height}px` : "100%",
    transform: parts.join(" "),
    transformOrigin: "center center",
    opacity: cfg.opacity / 100,
    zIndex: LAYER_Z[cfg.layer] ?? 120,
    willChange: "transform, opacity",
    pointerEvents: "none",
  };
}

export const OBJECT_FIT: Record<GiftFitMode, React.CSSProperties["objectFit"]> = {
  contain: "contain",
  cover: "cover",
  fill: "fill",
  original: "none",
  stretch: "fill",
};
