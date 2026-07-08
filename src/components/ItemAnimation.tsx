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
 * Static PNG-style preview for each shop item category.
 * Non-theme categories render the matching /animations/{slug}.svg as a static image.
 * Theme keeps a subtle animated gradient (background preview).
 */
export function ItemAnimation({ slug, name, primary, accent, size = 120, fill }: Props) {
  const wrap: CSSProperties = fill
    ? { position: "absolute", inset: 0 }
    : { width: size, height: size, position: "relative" };

  const normalized = (slug ?? "").toLowerCase().trim();

  const STATIC_MAP: Record<string, string> = {
    frame: "/animations/frame.svg",
    frames: "/animations/frame.svg",
    ring: "/animations/ring.svg",
    rings: "/animations/ring.svg",
    bubble: "/animations/bubble.svg",
    bubbles: "/animations/bubble.svg",
    car: "/animations/car.svg",
    cars: "/animations/car.svg",
    vehicle: "/animations/car.svg",
    entrance: "/animations/entrance.svg",
    entry: "/animations/entrance.svg",
    special_id: "/animations/special_id.svg",
    "special id": "/animations/special_id.svg",
    specialid: "/animations/special_id.svg",
    id: "/animations/special_id.svg",
    data_card: "/animations/data_card.svg",
    "data card": "/animations/data_card.svg",
    datacard: "/animations/data_card.svg",
    card: "/animations/data_card.svg",
  };

  const staticSrc = STATIC_MAP[normalized];

  // Data card gets a themed overlay with the buyer's name (static, no flip)
  if (normalized === "data_card" || normalized === "data card" || normalized === "datacard" || normalized === "card") {
    return (
      <div style={wrap} className="grid place-items-center overflow-hidden">
        <div
          className="relative rounded-xl p-3 text-[10px] font-bold text-white shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
          style={{
            width: "82%",
            aspectRatio: "1.6/1",
            background: `linear-gradient(135deg, ${primary}, ${accent})`,
          }}
        >
          <div className="opacity-80">JALWA · ID CARD</div>
          <div className="mt-2 truncate text-base font-black">{name?.slice(0, 14) ?? "MEMBER"}</div>
          <div className="mt-1 text-[8px] opacity-70">★ ★ ★ ★ ★</div>
        </div>
      </div>
    );
  }

  if (staticSrc) {
    return (
      <div style={wrap} className="grid place-items-center overflow-hidden">
        <img
          src={staticSrc}
          alt={name ?? normalized}
          loading="lazy"
          decoding="async"
          className="h-[85%] w-[85%] object-contain"
          style={{ filter: `drop-shadow(0 4px 12px ${primary}66)` }}
        />
      </div>
    );
  }

  // Theme / background fallback — animated gradient preview
  return (
    <div
      style={{ ...wrap, background: `linear-gradient(135deg, ${primary}, ${accent})` }}
      className="grid place-items-center overflow-hidden"
    >
      <div
        className="anim-theme-shine absolute inset-0"
        style={{
          background: `radial-gradient(60% 40% at 30% 20%, ${accent}88, transparent 70%), radial-gradient(50% 40% at 80% 90%, ${primary}88, transparent 70%)`,
        }}
      />
    </div>
  );
}
