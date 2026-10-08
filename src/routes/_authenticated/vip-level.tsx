import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useVipProfile } from "@/hooks/useVipProfile";
import { vipProgressFor, VIP_TIERS, formatCoins } from "@/lib/vip-levels";
import { ArrowLeft, Crown, Gift, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vip-level")({ component: VipLevelPage });

function VipLevelPage() {
  const { user, profile } = useAuth();
  const { data: vip } = useVipProfile(user?.id);
  const level = Number(vip?.row.vip_level ?? profile?.vip_level ?? profile?.level ?? 0);
  const totalGifted = Number(vip?.row.total_gifted_coins ?? 0);
  const progress = vipProgressFor(totalGifted, level);
  const currentIndex = VIP_TIERS.findIndex((t) => level >= t.minLevel && level <= t.maxLevel);
  const nextTier = VIP_TIERS[currentIndex + 1];

  return (
    <>
      <AppShell title="VIP Level" showHeader={false}>
        <div className="min-h-full bg-background text-foreground pb-24">
          <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-black/60 px-4 py-3 backdrop-blur-xl" style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}>
            <Link to="/me" aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <p className="text-sm font-black text-white">VIP Level Details</p>
              <p className="text-[10px] uppercase tracking-widest text-white/45">Lifetime gift-based level</p>
            </div>
          </div>

          <div className="px-4 pt-5">
            <div className="rounded-3xl border border-[#fbbf24]/30 bg-gradient-to-br from-[#2a1603] via-[#160b18] to-[#090711] p-5 shadow-[0_0_35px_rgba(251,191,36,0.14)]">
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-2xl border border-[#fbbf24]/40 bg-[#fbbf24]/10">
                  <Crown className="h-8 w-8 text-[#fbbf24]" fill="currentColor" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-widest text-white/45">Current Level</p>
                  <h1 className="mt-1 text-2xl font-black text-white">Lv {level}</h1>
                  <p className="mt-0.5 font-bold" style={{ color: progress.tier.color }}>{progress.tier.label}</p>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/50">Lifetime gifted coins</span>
                  <span className="font-black text-[#fbbf24]">{formatCoins(totalGifted)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#fbbf24] to-[#f97316]" style={{ width: `${progress.percent}%` }} />
                </div>
                {!progress.isMax && (
                  <p className="mt-2 text-[10px] text-white/45">
                    {formatCoins(progress.remaining)} coins remaining for Lv {level + 1}
                  </p>
                )}
              </div>
            </div>
          </div>

          <section className="px-4 pt-5">
            <div className="mb-3 flex items-center gap-2">
              <Gift className="h-4 w-4 text-[#fbbf24]" />
              <h2 className="text-sm font-black text-white">VIP Level Tiers</h2>
            </div>
            <div className="space-y-2">
              {VIP_TIERS.map((tier) => {
                const active = level >= tier.minLevel && level <= tier.maxLevel;
                return (
                  <div key={tier.key} className={`rounded-2xl border p-3 ${active ? "border-[#fbbf24]/50 bg-[#fbbf24]/10" : "border-white/10 bg-white/[0.03]"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{tier.icon}</span>
                        <div>
                          <p className="text-sm font-black text-white">{tier.label}</p>
                          <p className="text-[10px] text-white/45">Levels {tier.minLevel}–{tier.maxLevel}</p>
                        </div>
                      </div>
                      {active && <span className="rounded-full bg-[#fbbf24]/15 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#fbbf24]">Current</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {nextTier && (
            <div className="mx-4 mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-white">
                <Sparkles className="h-4 w-4 text-[#fbbf24]" />
                <p className="text-xs font-black uppercase tracking-widest">Next Tier</p>
              </div>
              <p className="mt-2 text-sm font-black text-white">{nextTier.label}</p>
              <p className="mt-1 text-[11px] text-white/50">Reach level {nextTier.minLevel} through lifetime gift spending.</p>
            </div>
          )}

          <div className="mx-4 mt-5 rounded-2xl border border-[#a855f7]/25 bg-[#a855f7]/5 p-4">
            <p className="text-xs font-black uppercase tracking-widest text-[#c084fc]">Separate from VIP Membership</p>
            <p className="mt-2 text-[11px] leading-5 text-white/55">
              VIP Level never expires and is earned from lifetime gifts sent. Paid VIP Membership is a separate subscription with its own expiry.
            </p>
            <Link to="/vip" className="mt-3 inline-flex rounded-xl border border-[#a855f7]/40 bg-[#a855f7]/10 px-3 py-2 text-xs font-black text-[#d8b4fe]">
              Open VIP Membership
            </Link>
          </div>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
