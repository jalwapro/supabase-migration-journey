import { useEffect, useRef, useState } from "react";

/**
 * TikTok-style floating tap hearts.
 * Listens for `jalwa:heart-tap` window events and animates a heart bursting
 * from the tap position, floating upward with a slight sway.
 *
 * Dispatch anywhere:
 *   window.dispatchEvent(new CustomEvent("jalwa:heart-tap", { detail: { x, y } }));
 */

type Heart = {
  id: number;
  x: number;
  y: number;
  color: string;
  rot: number;
  sway: number;
  size: number;
  emoji: string;
};

const COLORS = ["#fe2c55", "#ff5177", "#ff2e93", "#ff8ba0", "#ffd447", "#a855f7"];
const EMOJIS = ["❤️", "💖", "💕", "💗", "💓", "💘"];

let counter = 0;

export function TapHearts() {
  const [hearts, setHearts] = useState<Heart[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const onTap = (e: Event) => {
      const detail = (e as CustomEvent<{ x?: number; y?: number; count?: number }>).detail ?? {};
      const cx = typeof detail.x === "number" ? detail.x : window.innerWidth / 2;
      const cy = typeof detail.y === "number" ? detail.y : window.innerHeight - 120;
      const count = Math.max(1, Math.min(6, detail.count ?? 1));

      const batch: Heart[] = [];
      for (let i = 0; i < count; i++) {
        const id = ++counter;
        batch.push({
          id,
          x: cx + (Math.random() * 24 - 12),
          y: cy + (Math.random() * 12 - 6),
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          rot: Math.random() * 60 - 30,
          sway: Math.random() * 80 - 40,
          size: 34 + Math.random() * 22,
          emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        });
      }
      setHearts((prev) => [...prev, ...batch].slice(-60));

      // schedule cleanup ~2s later
      const ids = batch.map((h) => h.id);
      window.setTimeout(() => {
        setHearts((prev) => prev.filter((h) => !ids.includes(h.id)));
      }, 2200);
    };
    window.addEventListener("jalwa:heart-tap", onTap);
    return () => {
      window.removeEventListener("jalwa:heart-tap", onTap);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {hearts.map((h) => (
        <span
          key={h.id}
          className="tap-heart"
          style={
            {
              left: h.x,
              top: h.y,
              fontSize: h.size,
              color: h.color,
              "--sway": `${h.sway}px`,
              "--rot": `${h.rot}deg`,
              filter: `drop-shadow(0 0 6px ${h.color}aa)`,
            } as React.CSSProperties
          }
        >
          {h.emoji}
        </span>
      ))}
    </div>
  );
}

/** Fire a heart tap at a screen position (or the center if omitted). */
export function fireHeartTap(x?: number, y?: number, count = 1) {
  try {
    window.dispatchEvent(
      new CustomEvent("jalwa:heart-tap", { detail: { x, y, count } }),
    );
  } catch {
    /* noop */
  }
}
