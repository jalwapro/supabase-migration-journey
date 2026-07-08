import type { CSSProperties } from "react";

type Props = {
  slug: string | null | undefined;
  name?: string;
  primary: string;
  accent: string;
  size?: number; // px, for card mode
  fill?: boolean; // fill parent
};

/**
 * Pure CSS/SVG animated preview for each shop item category.
 * No external assets required — every category has a distinct motion.
 */
export function ItemAnimation({ slug, name, primary, accent, size = 120, fill }: Props) {
  const wrap: CSSProperties = fill
    ? { position: "absolute", inset: 0 }
    : { width: size, height: size, position: "relative" };

  switch (slug) {
    case "car":
      return (
        <div style={wrap} className="grid place-items-center overflow-hidden">
          <div className="anim-car-track">
            <svg viewBox="0 0 120 60" className="anim-car" style={{ width: "70%", filter: `drop-shadow(0 0 12px ${primary})` }}>
              <defs>
                <linearGradient id={`cg-${primary}`} x1="0" x2="1">
                  <stop offset="0" stopColor={primary} />
                  <stop offset="1" stopColor={accent} />
                </linearGradient>
              </defs>
              <path d="M10 40 Q20 22 45 22 L75 22 Q95 22 105 38 L110 42 L110 48 L10 48 Z" fill={`url(#cg-${primary})`} stroke={accent} strokeWidth="1.5" />
              <rect x="45" y="26" width="30" height="10" rx="2" fill="#0008" />
              <circle cx="30" cy="48" r="7" fill="#111" stroke={accent} strokeWidth="2" />
              <circle cx="90" cy="48" r="7" fill="#111" stroke={accent} strokeWidth="2" />
            </svg>
          </div>
        </div>
      );

    case "frame":
      return (
        <div style={wrap} className="grid place-items-center">
          <div className="anim-frame-spin relative" style={{ width: "80%", aspectRatio: "1/1" }}>
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(from 0deg, ${primary}, ${accent}, ${primary})`,
                mask: "radial-gradient(circle, transparent 55%, #000 57%, #000 100%)",
                WebkitMask: "radial-gradient(circle, transparent 55%, #000 57%, #000 100%)",
              }}
            />
            <div className="absolute inset-[8%] rounded-full border-2" style={{ borderColor: accent, boxShadow: `0 0 16px ${primary}` }} />
          </div>
        </div>
      );

    case "ring":
      return (
        <div style={wrap} className="grid place-items-center">
          <div className="relative anim-ring-float" style={{ width: "70%", aspectRatio: "1/1" }}>
            <div
              className="absolute inset-0 rounded-full border-[6px]"
              style={{ borderColor: primary, boxShadow: `0 0 22px ${primary}, inset 0 0 12px ${accent}` }}
            />
            <div className="absolute left-1/2 top-0 -translate-x-1/2 anim-ring-gem"
              style={{
                width: "24%", height: "24%",
                background: `linear-gradient(135deg, #fff, ${accent})`,
                clipPath: "polygon(50% 0, 100% 40%, 80% 100%, 20% 100%, 0 40%)",
                filter: `drop-shadow(0 0 8px ${primary})`,
              }}
            />
          </div>
        </div>
      );

    case "entrance":
      return (
        <div style={wrap} className="grid place-items-center overflow-hidden">
          <div className="relative" style={{ width: "90%", height: "90%" }}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <span
                key={i}
                className="anim-entrance-spark absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
                style={{
                  background: i % 2 ? primary : accent,
                  transform: `translate(-50%, -50%) rotate(${i * 45}deg)`,
                  animationDelay: `${i * 0.08}s`,
                  boxShadow: `0 0 8px ${primary}`,
                }}
              />
            ))}
            <div
              className="anim-entrance-core absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: `radial-gradient(circle, ${primary}, ${accent})`, boxShadow: `0 0 24px ${primary}` }}
            />
          </div>
        </div>
      );

    case "bubble":
      return (
        <div style={wrap} className="grid place-items-center">
          <div className="anim-bubble-float relative" style={{ width: "80%" }}>
            <div
              className="rounded-2xl px-3 py-2 text-[10px] font-bold text-white"
              style={{
                background: `linear-gradient(135deg, ${primary}, ${accent})`,
                boxShadow: `0 0 18px ${primary}`,
              }}
            >
              Hey! ✨
            </div>
            <span
              className="absolute -bottom-1 left-4 h-3 w-3 rotate-45"
              style={{ background: accent }}
            />
          </div>
        </div>
      );

    case "data_card":
      return (
        <div style={wrap} className="grid place-items-center perspective">
          <div
            className="anim-card-flip rounded-xl p-3 text-[10px] font-bold text-white"
            style={{
              width: "78%", aspectRatio: "1.6/1",
              background: `linear-gradient(135deg, ${primary}, ${accent})`,
              boxShadow: `0 8px 24px ${primary}`,
            }}
          >
            <div className="opacity-80">JALWA · ID CARD</div>
            <div className="mt-3 text-base">{name?.slice(0, 12) ?? "MEMBER"}</div>
            <div className="mt-1 text-[8px] opacity-70">★ ★ ★ ★ ★</div>
          </div>
        </div>
      );

    case "special_id":
      return (
        <div style={wrap} className="grid place-items-center">
          <div
            className="anim-id-shimmer rounded-xl px-4 py-2 font-black tracking-widest"
            style={{
              background: `linear-gradient(90deg, ${primary}, ${accent}, ${primary})`,
              backgroundSize: "200% 100%",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              fontSize: "1.4rem",
              textShadow: `0 0 12px ${primary}`,
            }}
          >
            8888
          </div>
        </div>
      );

    case "theme":
    default:
      return (
        <div
          style={{ ...wrap, background: `linear-gradient(135deg, ${primary}, ${accent})` }}
          className="grid place-items-center overflow-hidden"
        >
          <div className="anim-theme-shine absolute inset-0" style={{
            background: `radial-gradient(60% 40% at 30% 20%, ${accent}88, transparent 70%), radial-gradient(50% 40% at 80% 90%, ${primary}88, transparent 70%)`,
          }} />
        </div>
      );
  }
}
