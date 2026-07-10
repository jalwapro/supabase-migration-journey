import { MILESTONE_REWARDS, VIP_TIERS, VIP_THRESHOLDS, formatCoins } from "@/lib/vip-levels";

/**
 * Grid of the 10 milestone rewards (Lv 10, 20, ..., 100).
 * Highlights unlocked tiers based on current level.
 */
export function VipRewardsGrid({ currentLevel }: { currentLevel: number }) {
  const milestones = Object.keys(MILESTONE_REWARDS).map(Number).sort((a, b) => a - b);
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/60">
        Milestone Rewards
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {milestones.map((lvl) => {
          const unlocked = currentLevel >= lvl;
          const tier = VIP_TIERS.find((t) => lvl >= t.minLevel && lvl <= t.maxLevel) ?? VIP_TIERS[0];
          const reward = MILESTONE_REWARDS[lvl];
          return (
            <div
              key={lvl}
              className="relative overflow-hidden rounded-xl border p-2 text-center"
              style={{
                borderColor: unlocked ? `${tier.color}80` : "rgba(255,255,255,0.08)",
                background: unlocked
                  ? `linear-gradient(135deg, ${tier.color}33, transparent)`
                  : "rgba(0,0,0,0.4)",
                filter: unlocked ? "none" : "grayscale(0.7) opacity(0.7)",
                boxShadow: unlocked ? `0 0 16px -6px ${tier.glow}` : "none",
              }}
            >
              <div className="text-lg">{tier.icon}</div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white">Lv {lvl}</p>
              <p className="text-[9px] text-white/70">{tier.label}</p>
              <p className="mt-1 text-xs font-black text-[color:var(--gold)]">
                +{formatCoins(reward.coins)}
              </p>
              <p className="text-[9px] leading-tight text-white/60">{reward.bundle}</p>
              <p className="mt-1 text-[9px] text-white/50">
                Need {formatCoins(VIP_THRESHOLDS[lvl])}
              </p>
              {!unlocked && (
                <div className="pointer-events-none absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-[1px] text-[8px] font-bold text-white/70">
                  🔒
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
