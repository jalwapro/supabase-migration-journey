import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import { toast } from "sonner";
import { TheatreCard, TheatreDivider, TheatreRow, GoldCoinPill } from "@/components/theatre/TheatreCard";

export const Route = createFileRoute("/_authenticated/vip")({ component: Page });

function Page() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const { data: tiers } = useQuery({
    queryKey: ["vip-tiers"],
    queryFn: async () => {
      const { data } = await supabase.from("vip_tiers").select("*").order("price");
      return data ?? [];
    },
  });

  async function subscribe(tier: any) {
    if (!user || !profile) return;
    if ((profile.coins ?? 0) < tier.price) return toast.error("Not enough coins");
    const { data, error } = await supabase.rpc("purchase_vip", { _tier_id: tier.id });
    if (error) return toast.error(error.message);
    const result = data as { tier?: string; coins_after?: number } | null;
    toast.success(`Welcome to ${result?.tier ?? tier.name} VIP`);
    qc.invalidateQueries();
  }

  return (
    <>
      <AppShell title="VIP Membership">
        <TheatreCard>
          {/* VIP PASS CARD */}
          <div className="px-4 pt-5">
            <div
              className="relative overflow-hidden rounded-2xl border border-[#ffcf6a]/40 p-4 shadow-[0_10px_40px_-10px_rgba(255,207,106,0.5)]"
              style={{
                background:
                  "linear-gradient(135deg,#2a1000 0%,#4a1e00 30%,#1a0800 65%,#3a1400 100%)",
              }}
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#ffd66a]/20 blur-3xl" />
              <div className="pointer-events-none absolute -left-10 -bottom-10 h-28 w-28 rounded-full bg-[#c48a1a]/20 blur-3xl" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-[#ffd66a]" fill="currentColor" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ffcf6a]">
                    Jalwa VIP Pass
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                    profile?.is_vip
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-white/10 text-white/50 border border-white/20"
                  }`}
                >
                  {profile?.is_vip ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="relative">
                  <div
                    className="h-14 w-14 rounded-full border-2 border-[#ffd66a] bg-cover bg-center"
                    style={{
                      backgroundImage: profile?.avatar
                        ? `url(${profile.avatar})`
                        : "linear-gradient(135deg,#4a1e00,#1a0800)",
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black text-white drop-shadow">
                    {profile?.username ?? "Guest"}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-[#ffcf6a]/70">
                    ID · {user?.id?.slice(0, 8).toUpperCase() ?? "—"}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
                  <p className="uppercase tracking-widest text-white/40">Coins</p>
                  <p className="mt-0.5 font-black text-[#ffd66a]">
                    {(profile?.coins ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
                  <p className="uppercase tracking-widest text-white/40">Expires</p>
                  <p className="mt-0.5 font-black text-white">
                    {profile?.is_vip && profile.vip_expiry
                      ? new Date(profile.vip_expiry).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-1 rounded-lg border border-[#ffcf6a]/20 bg-black/30 px-3 py-2 text-[10px] text-white/80">
                <p className="font-black uppercase tracking-widest text-[#ffcf6a]">Pass Benefits</p>
                <p>👑 Unlock all VIP-only animated emojis</p>
                <p>✨ Exclusive VIP badge + frame in rooms</p>
                <p>🎁 Premium gifts & spotlight priority</p>
                <p>🔥 Higher daily rewards & milestone bonuses</p>
              </div>
            </div>
          </div>

          <TheatreDivider label="Membership" />

          <div className="space-y-3 px-4 pt-5 pb-6">
            {(tiers ?? []).map((t: any) => (
              <TheatreRow key={t.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-black text-[#ffcf6a] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                      {t.name}
                    </p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-white/50">
                      {t.duration_days} days
                    </p>
                  </div>
                  <GoldCoinPill>{t.price.toLocaleString()}</GoldCoinPill>
                </div>
                <button
                  onClick={() => subscribe(t)}
                  className="mt-3 w-full rounded-xl py-2.5 text-sm font-black text-[#3a1400] shadow-[0_6px_18px_rgba(255,207,106,0.4)]"
                  style={{
                    background:
                      "linear-gradient(180deg,#ffe8a8 0%,#ffcf6a 45%,#c48a1a 100%)",
                  }}
                >
                  Subscribe
                </button>
              </TheatreRow>
            ))}
            {(tiers ?? []).length === 0 && (
              <p className="py-8 text-center text-xs text-white/50">No VIP tiers configured</p>
            )}
          </div>
        </TheatreCard>
      </AppShell>
      <BottomNav />
    </>
  );
}
