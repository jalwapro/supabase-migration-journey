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
          {/* Crown hero */}
          <div className="px-6 pt-8 pb-4 text-center">
            <div className="relative mx-auto w-fit">
              <Crown
                className="h-14 w-14 text-[#ffd66a] drop-shadow-[0_0_18px_rgba(255,200,80,0.9)]"
                fill="currentColor"
                strokeWidth={0.8}
              />
              <div className="absolute -inset-4 rounded-full bg-[#ffd66a]/25 blur-2xl animate-pulse" />
            </div>
            <p className="mt-3 text-xl font-black tracking-wide text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
              {profile?.is_vip ? "You're VIP" : "Become VIP"}
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#ffcf6a]/70">
              {profile?.is_vip && profile.vip_expiry
                ? `Expires ${new Date(profile.vip_expiry).toLocaleDateString()}`
                : "Unlock badges · frames · perks"}
            </p>
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
