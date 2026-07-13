/**
 * Face sticker presets. Rendered as emoji glyphs onto canvas — no image assets
 * needed, works on every device. Each sticker anchors on face landmarks
 * from MediaPipe FaceLandmarker (468-point model).
 *
 * Key landmarks used:
 *   10  = forehead top
 *   1   = nose tip
 *   152 = chin bottom
 *   33  = right-eye outer
 *   263 = left-eye outer
 *   61  = mouth right
 *   291 = mouth left
 *   13  = upper-lip center
 */

export type StickerAnchor =
  | "forehead" // above the eyes, based on landmark 10
  | "eyes" // centered between eyes (glasses)
  | "ears" // top-of-head, wider (bunny/cat ears)
  | "nose" // on nose tip
  | "mouth" // below nose, above chin
  | "face-around"; // floating around head (hearts, sparkles)

export interface Sticker {
  id: string;
  label: string;
  emoji: string;
  /** Multiple glyphs stacked for effect (e.g. cat ears = 2 triangles). */
  glyphs?: string[];
  anchor: StickerAnchor;
  /** Scale relative to face width. 1.0 = same as eye-to-eye distance. */
  scale: number;
  /** Vertical nudge in units of face height (negative = up). */
  offsetY?: number;
}

export const STICKERS: Sticker[] = [
  { id: "none", label: "None", emoji: "🚫", anchor: "eyes", scale: 0 },
  { id: "sunglasses", label: "Cool", emoji: "🕶️", anchor: "eyes", scale: 1.6 },
  { id: "nerdglasses", label: "Nerd", emoji: "🤓", anchor: "eyes", scale: 2.4 },
  { id: "crown", label: "Crown", emoji: "👑", anchor: "forehead", scale: 1.6, offsetY: -0.15 },
  { id: "flowercrown", label: "Flowers", emoji: "🌸", glyphs: ["🌸", "🌺", "🌼", "🌸", "🌺"], anchor: "forehead", scale: 0.5, offsetY: -0.12 },
  { id: "bunny", label: "Bunny", emoji: "🐰", anchor: "ears", scale: 1.4, offsetY: -0.25 },
  { id: "cat", label: "Cat", emoji: "🐱", anchor: "ears", scale: 1.4, offsetY: -0.2 },
  { id: "devil", label: "Devil", emoji: "😈", anchor: "ears", scale: 1.3, offsetY: -0.2 },
  { id: "mustache", label: "'Stache", emoji: "🥸", anchor: "mouth", scale: 2 },
  { id: "hearts", label: "Hearts", emoji: "💖", glyphs: ["💖", "💕", "💗", "💘", "💝"], anchor: "face-around", scale: 0.6 },
  { id: "sparkles", label: "Sparkle", emoji: "✨", glyphs: ["✨", "⭐", "🌟", "💫", "✨"], anchor: "face-around", scale: 0.55 },
  { id: "fire", label: "Fire", emoji: "🔥", glyphs: ["🔥", "🔥", "🔥"], anchor: "forehead", scale: 0.7, offsetY: -0.1 },
];

export const STICKER_BY_ID: Record<string, Sticker> = Object.fromEntries(
  STICKERS.map((s) => [s.id, s]),
);

interface FacePoint {
  x: number;
  y: number;
}

interface FaceMetrics {
  centerX: number;
  centerY: number;
  eyeDist: number; // pixels between outer eye corners
  faceH: number; // chin to forehead
  angle: number; // radians, roll
  forehead: FacePoint;
  nose: FacePoint;
  mouth: FacePoint;
  leftEar: FacePoint;
  rightEar: FacePoint;
}

export function computeFaceMetrics(
  landmarks: Array<{ x: number; y: number }>,
  w: number,
  h: number,
): FaceMetrics | null {
  if (!landmarks || landmarks.length < 300) return null;
  const p = (i: number): FacePoint => ({ x: landmarks[i].x * w, y: landmarks[i].y * h });
  const rEye = p(33);
  const lEye = p(263);
  const forehead = p(10);
  const chin = p(152);
  const nose = p(1);
  const mouth = p(13);
  const centerX = (rEye.x + lEye.x) / 2;
  const centerY = (rEye.y + lEye.y) / 2;
  const dx = lEye.x - rEye.x;
  const dy = lEye.y - rEye.y;
  const eyeDist = Math.hypot(dx, dy);
  const faceH = Math.hypot(chin.x - forehead.x, chin.y - forehead.y);
  const angle = Math.atan2(dy, dx);
  return {
    centerX,
    centerY,
    eyeDist,
    faceH,
    angle,
    forehead,
    nose,
    mouth,
    leftEar: { x: lEye.x + eyeDist * 0.3, y: forehead.y },
    rightEar: { x: rEye.x - eyeDist * 0.3, y: forehead.y },
  };
}

export function drawSticker(
  ctx: CanvasRenderingContext2D,
  sticker: Sticker,
  m: FaceMetrics,
): void {
  if (sticker.id === "none" || sticker.scale === 0) return;
  const glyphs = sticker.glyphs ?? [sticker.emoji];
  const baseSize = sticker.scale * m.eyeDist * 1.5;
  const offY = (sticker.offsetY ?? 0) * m.faceH;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // A serif family gives most emoji fonts a chance to render at high sizes.
  ctx.font = `${baseSize}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif`;

  switch (sticker.anchor) {
    case "eyes": {
      ctx.translate(m.centerX, m.centerY + offY);
      ctx.rotate(m.angle);
      ctx.fillText(glyphs[0], 0, 0);
      break;
    }
    case "forehead": {
      const anchorX = m.forehead.x;
      const anchorY = m.forehead.y + offY - baseSize * 0.15;
      ctx.translate(anchorX, anchorY);
      ctx.rotate(m.angle);
      if (glyphs.length === 1) {
        ctx.fillText(glyphs[0], 0, 0);
      } else {
        // spread across forehead
        const spread = m.eyeDist * 1.4;
        const step = spread / (glyphs.length - 1);
        for (let i = 0; i < glyphs.length; i++) {
          const x = -spread / 2 + step * i;
          const y = Math.sin(i * 1.3) * baseSize * 0.15;
          ctx.fillText(glyphs[i], x, y);
        }
      }
      break;
    }
    case "ears": {
      // Two glyphs, one on each side of head-top.
      const topY = m.forehead.y + offY;
      const halfSpread = m.eyeDist * 0.9;
      ctx.translate((m.forehead.x), topY);
      ctx.rotate(m.angle);
      ctx.fillText(glyphs[0], -halfSpread, 0);
      ctx.fillText(glyphs[0], halfSpread, 0);
      break;
    }
    case "nose": {
      ctx.translate(m.nose.x, m.nose.y + offY);
      ctx.rotate(m.angle);
      ctx.fillText(glyphs[0], 0, 0);
      break;
    }
    case "mouth": {
      // Just above upper lip
      const anchorY = m.mouth.y + offY - baseSize * 0.35;
      ctx.translate(m.mouth.x, anchorY);
      ctx.rotate(m.angle);
      ctx.fillText(glyphs[0], 0, 0);
      break;
    }
    case "face-around": {
      // Static floating around face — 5 positions on ellipse.
      const rx = m.eyeDist * 1.6;
      const ry = m.faceH * 0.7;
      const t = performance.now() / 800; // gentle animation
      for (let i = 0; i < glyphs.length; i++) {
        const a = (i / glyphs.length) * Math.PI * 2 + t;
        const x = m.centerX + Math.cos(a) * rx;
        const y = m.centerY + Math.sin(a) * ry * 0.9;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(t + i) * 0.3);
        ctx.fillText(glyphs[i], 0, 0);
        ctx.restore();
      }
      break;
    }
  }
  ctx.restore();
}
