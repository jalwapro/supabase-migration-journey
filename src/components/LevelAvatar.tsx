import { tierForLevel } from "@/lib/levels";
import { User as UserIcon } from "lucide-react";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<Size, number> = { sm: 40, md: 56, lg: 80, xl: 112 };

export function LevelAvatar({
  src,
  name,
  level,
  size = "md",
  showBadge = true,
  className = "",
}: {
  src?: string | null;
  name?: string | null;
  level: number;
  size?: Size;
  showBadge?: boolean;
  className?: string;
}) {
  const tier = tierForLevel(level);
  const px = SIZE_PX[size];
  const initial = (name ?? "J").slice(0, 1).toUpperCase();

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: px, height: px }}
    >
      {/* Gradient ring (static for mobile GPU stability) */}
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-tr ${tier.ringGradient}`}
        style={{
          boxShadow: `0 0 18px -2px ${tier.glow}`,
          maskImage:
            "radial-gradient(circle, transparent 58%, black 60%)",
          WebkitMaskImage:
            "radial-gradient(circle, transparent 58%, black 60%)",
        }}
      />
      {/* Inner disc */}
      <div
        className="absolute inset-[8%] overflow-hidden rounded-full bg-gradient-to-br from-[color:var(--primary)]/70 to-[color:var(--secondary)]/70 ring-2 ring-black/40"
      >
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

      {/* Level chip */}
      {showBadge && (
        <span
          className={`absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r ${tier.badgeGradient} px-2 py-[1px] text-[9px] font-black uppercase tracking-widest text-white shadow-lg ring-1 ring-black/40`}
        >
          <span className="mr-0.5">{tier.icon}</span>
          Lv {level}
        </span>
      )}
    </div>
  );
}
