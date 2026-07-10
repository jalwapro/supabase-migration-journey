import { vipProgressFor, formatCoins, MILESTONE_REWARDS } from "@/lib/vip-levels";
import { VipBadge } from "./VipBadge";

/**
 * Premium VIP progress card: current level badge, animated bar, next-level
 * threshold, remaining coins, and next milestone reward preview.
 */
export function VipProgressBar({
  totalGifted,
  storedLevel,
  compact = false,
}: {
  totalGifted: number;
  storedLevel?: number | null;
  compact?: boolean;
}) {
  const p = vipProgressFor(totalGifted, storedLevel ?? 0);
  const tier = p.tier;

  // find next milestone (>= current level+1, or self if 100)
  const nextMilestone = Object.keys(MILESTONE_REWARDS)
    .map(Number).sort((a, b) => a - b)
    .find((lvl) => lvl > p.level) ?? 100;
  const reward = MILESTONE_REWARDS[nextMilestone];

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 p-4"
      style={{
        background: `linear-gradient(135deg, ${tier.color}22, transparent 60%), rgba(10,6,20,0.6)`,
        boxShadow: `0 0 40px -20px ${tier.glow}`,
      }}
    >
      {/* header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <VipBadge level={p.level} size="md" showLabel />
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-white/60">Lifetime Gift</p>
          <p className="text-sm font-black text-white">{formatCoins(p.totalGifted)}</p>
        </div>
      </div>

      {/* bar */}
      <div className="mt-3">
        <div className="relative h-3 overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${p.percent}%`,
              background: `linear-gradient(90deg, ${tier.color}, #fde68a)`,
              boxShadow: `0 0 12px ${tier.glow}`,
            }}
          />
          {/* shimmer */}
          <div
            className="pointer-events-none absolute inset-y-0 w-1/3 -translate-x-full animate-[vipShimmer_2.4s_infinite]"
            style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)" }}
          />
        </div>
        <style>{`@keyframes vipShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}`}</style>
      </div>

      {/* stats */}
      {!compact && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Current" value={formatCoins(p.totalGifted - p.currentLevelStart)} />
          <Stat label={p.isMax ? "Max" : "Next Lv"} value={p.isMax ? "MAX" : formatCoins(p.nextLevelAt)} />
          <Stat label="Remaining" value={p.isMax ? "0" : formatCoins(p.remaining)} />
        </div>
      )}

      {/* next reward */}
      {!p.isMax && reward && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/60">Next milestone · Lv {nextMilestone}</p>
            <p className="text-xs font-bold text-white">{reward.bundle}</p>
          </div>
          <p className="text-sm font-black text-[color:var(--gold)]">+{reward.coins.toLocaleString()} 🪙</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/30 px-2 py-1.5 ring-1 ring-white/10">
      <p className="text-[9px] uppercase tracking-widest text-white/50">{label}</p>
      <p className="text-xs font-black text-white">{value}</p>
    </div>
  );
}
