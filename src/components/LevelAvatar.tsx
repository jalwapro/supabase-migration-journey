import { vipTierForLevel as tierForLevel } from "@/lib/vip-levels";
import { User as UserIcon } from "lucide-react";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<Size, number> = { sm: 40, md: 56, lg: 80, xl: 112 };

export function LevelAvatar({
  src,
  name,
  level,
  size = "md",
  showBadge = true,
  frame,
  ring,
  className = "",
}: {
  src?: string | null;
  name?: string | null;
  level: number;
  size?: Size;
  showBadge?: boolean;
  /** Equipped DP frame media URL (image / gif / webp / mp4). Renders a sparkling overlay around the avatar. */
  frame?: string | null;
  /** Equipped aura ring media URL. Rotates behind the avatar. */
  ring?: string | null;
  className?: string;
}) {
  const tier = tierForLevel(level);
  const px = SIZE_PX[size];
  const initial = (name ?? "J").slice(0, 1).toUpperCase();
  const frameIsVideo = !!frame && /\.(mp4|webm|mov)($|\?)/i.test(frame);
  const ringIsVideo = !!ring && /\.(mp4|webm|mov)($|\?)/i.test(ring);

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: px, height: px }}
    >
      {/* Equipped aura ring behind avatar */}
      {ring && (
        <div className="pointer-events-none absolute inset-[-28%] z-0 dp-ring-spin" aria-hidden>
          {ringIsVideo ? (
            <video src={ring} autoPlay muted loop playsInline className="h-full w-full object-contain" />
          ) : (
            <img src={ring} alt="" className="h-full w-full object-contain" draggable={false} />
          )}
        </div>
      )}
      {/* Gradient ring (static for mobile GPU stability) */}
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-tr ${tier.ringGradient}`}
        style={{
          boxShadow: `0 0 18px -2px ${tier.glow}`,
          maskImage: "radial-gradient(circle, transparent 58%, black 60%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 58%, black 60%)",
        }}
      />
      {/* Inner disc */}
      <div className="absolute inset-[8%] overflow-hidden rounded-full bg-gradient-to-br from-[color:var(--primary)]/70 to-[color:var(--secondary)]/70 ring-2 ring-black/40">
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-white/90">
            {name ? (
              <span className="text-lg font-black">{initial}</span>
            ) : (
              <UserIcon className="h-1/2 w-1/2 opacity-80" />
            )}
          </div>
        )}
      </div>

      {/* Equipped DP frame overlay with sparkles.
          Frame art (crown+wings) has its transparent hole roughly centered but
          content extends outward — use a larger inset so the hole matches the
          avatar disc, and a small upward shift so crown-style frames align. */}
      {frame && (
        <>
          <div
            className="pointer-events-none absolute inset-[-42%] z-[5]"
            style={{ transform: "translateY(-6%)" }}
            aria-hidden
          >
            {frameIsVideo ? (
              <video
                src={frame}
                autoPlay
                muted
                loop
                playsInline
                className="h-full w-full object-contain"
              />
            ) : (
              <img
                src={frame}
                alt=""
                className="h-full w-full object-contain"
                draggable={false}
              />
            )}
          </div>
          {/* Sparkle particles */}
          <span className="pointer-events-none absolute inset-[-22%] z-[6]" aria-hidden>
            <span className="dp-sparkle dp-sparkle-a" />
            <span className="dp-sparkle dp-sparkle-b" />
            <span className="dp-sparkle dp-sparkle-c" />
            <span className="dp-sparkle dp-sparkle-d" />
          </span>
        </>
      )}

      {/* Level chip */}
      {showBadge && (
        <span
          className={`absolute -bottom-1 left-1/2 z-10 -translate-x-1/2 rounded-full bg-gradient-to-r ${tier.gradient} px-2 py-[1px] text-[9px] font-black uppercase tracking-widest text-white shadow-lg ring-1 ring-black/40`}
        >
          <span className="mr-0.5">{tier.icon}</span>
          Lv {level}
        </span>
      )}
    </div>
  );
}
