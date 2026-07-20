import { vipTierForLevel } from "@/lib/vip-levels";

/**
 * Animated VIP badge chip. Tier-colored gradient + glow + tier icon + level number.
 * Sizes: xs (chat), sm (cards), md (profile hero).
 */
export function VipBadge({
  level,
  size = "sm",
  showLabel = false,
  className = "",
}: {
  level: number;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
  className?: string;
}) {
  const tier = vipTierForLevel(level);
  const sizeCls =
    size === "xs" ? "text-[9px] px-1.5 py-[1px] gap-0.5"
    : size === "md" ? "text-sm px-3 py-1 gap-1.5"
    : "text-[10px] px-2 py-0.5 gap-1";

  return (
    <span
      data-keep-dark
      className={`inline-flex items-center rounded-full font-black uppercase tracking-widest text-white shadow-lg ring-1 ring-black/40 bg-gradient-to-r ${tier.gradient} ${sizeCls} ${className}`}
      style={{ boxShadow: `0 0 12px -2px ${tier.glow}`, color: "#fff" }}
      title={`${tier.label} · Level ${level}`}
    >
      <span className="leading-none" style={{ color: "#fff" }}>{tier.icon}</span>
      <span className="leading-none" style={{ color: "#fff" }}>Lv {level}</span>
      {showLabel && <span className="ml-1 opacity-90 normal-case tracking-normal" style={{ color: "#fff" }}>{tier.label}</span>}
    </span>
  );
}
