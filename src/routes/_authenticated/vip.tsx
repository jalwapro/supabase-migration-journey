import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import { toast } from "sonner";

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
    if (profile.coins < tier.price) return toast.error("Not enough coins");
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + (tier.duration_days ?? 30));
    const { error } = await supabase
      .from("profiles")
      .update({ is_vip: true, vip_expiry: expiry.toISOString(), coins: profile.coins - tier.price })
      .eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success(`Welcome to ${tier.name} VIP`);
    qc.invalidateQueries();
  }

  return (
    <>
      <AppShell title="VIP Membership">
        <div className="space-y-4 px-4 pt-4">
          <div className="glass rounded-3xl p-5 text-center">
            <Crown className="mx-auto h-10 w-10 text-[color:var(--gold)]" />
            <p className="mt-2 text-lg font-black">
              {profile?.is_vip ? "You're VIP" : "Become VIP"}
            </p>
            <p className="text-xs text-muted-foreground">
              {profile?.is_vip && profile.vip_expiry
                ? `Expires ${new Date(profile.vip_expiry).toLocaleDateString()}`
                : "Unlock badges, frames & exclusive perks"}
            </p>
          </div>

          <div className="space-y-3">
            {(tiers ?? []).map((t: any) => (
              <div key={t.id} className="rounded-2xl border border-[color:var(--gold)]/40 bg-card/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-black text-[color:var(--gold)]">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">{t.duration_days} days</p>
                  </div>
                  <p className="text-lg font-black">💰 {t.price}</p>
                </div>
                <button
                  onClick={() => subscribe(t)}
                  className="mt-3 w-full rounded-xl bg-[color:var(--gold)] py-2.5 text-sm font-black text-black"
                >
                  Subscribe
                </button>
              </div>
            ))}
            {(tiers ?? []).length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">No VIP tiers configured</p>
            )}
          </div>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
