import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Coins,
  ArrowDownToLine,
  Gift,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { formatCompact } from "@/lib/utils";
import { TheatreCard, TheatreDivider, TheatreRow } from "@/components/theatre/TheatreCard";

export const Route = createFileRoute("/_authenticated/wallet")({
  component: WalletPage,
});

type Tx = {
  id: string;
  kind: string;
  coins_delta: number;
  diamonds_delta: number;
  note: string | null;
  created_at: string;
};

function WalletPage() {
  const { profile, user } = useAuth();

  const txs = useQuery({
    queryKey: ["wallet_tx", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("id,kind,coins_delta,diamonds_delta,note,created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as Tx[];
    },
  });

  return (
    <>
      <AppShell title="Wallet" subtitle="Coins & points">
        <TheatreCard>
          {/* Balance hero */}
          <div className="px-6 pt-8 pb-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#ffcf6a]/70">
              Coins balance
            </p>
            <div className="mt-2 inline-flex items-center gap-3">
              <div className="relative">
                <Coins
                  className="h-11 w-11 text-[#ffd66a] drop-shadow-[0_0_16px_rgba(255,200,80,0.9)]"
                  fill="currentColor"
                  strokeWidth={0.8}
                />
                <div className="absolute -inset-3 rounded-full bg-[#ffd66a]/25 blur-2xl animate-pulse" />
              </div>
              <span
                className="text-5xl font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]"
                title={(profile?.coins ?? 0).toLocaleString()}
              >
                {formatCompact(profile?.coins ?? 0)}
              </span>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <Link
                to="/recharge"
                className="flex-1 rounded-full py-2.5 text-center text-sm font-black text-[#3a1400] shadow-[0_6px_18px_rgba(255,207,106,0.45)]"
                style={{
                  background: "linear-gradient(180deg,#ffe8a8 0%,#ffcf6a 45%,#c48a1a 100%)",
                }}
              >
                <ArrowDownToLine className="mr-1.5 inline h-4 w-4" />
                Recharge
              </Link>
              <button
                onClick={() =>
                  document
                    .getElementById("wallet-history")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="rounded-full border border-[#ffcf6a]/30 bg-black/40 px-4 py-2.5 text-sm font-bold text-[#ffcf6a]"
              >
                History
              </button>
            </div>
          </div>

          <TheatreDivider label="Ledger" />

          <section id="wallet-history" className="px-3 pt-5 pb-6">
            {txs.data?.length ? (
              <div className="space-y-2">
                {txs.data.map((t) => {
                  const positive = t.coins_delta > 0 || t.diamonds_delta > 0;
                  const Icon =
                    t.kind === "gift_sent" || t.kind === "gift_received"
                      ? Gift
                      : positive
                        ? TrendingUp
                        : TrendingDown;
                  return (
                    <TheatreRow key={t.id}>
                      <div className="flex items-center gap-3">
                        <div
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border ${
                            positive
                              ? "border-emerald-400/40 bg-emerald-500/15"
                              : "border-red-400/40 bg-red-500/15"
                          }`}
                        >
                          <Icon
                            className={`h-4 w-4 ${
                              positive ? "text-emerald-300" : "text-red-300"
                            }`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold capitalize text-white">
                            {t.kind.replace(/_/g, " ")}
                          </p>
                          {t.note && (
                            <p className="truncate text-[11px] text-white/55">{t.note}</p>
                          )}
                        </div>
                        <div className="text-right">
                          {t.coins_delta !== 0 && (
                            <p
                              className={`text-sm font-black ${
                                t.coins_delta > 0 ? "text-[#ffcf6a]" : "text-red-300"
                              }`}
                            >
                              {t.coins_delta > 0 ? "+" : ""}
                              {formatCompact(t.coins_delta)}
                            </p>
                          )}
                          {t.diamonds_delta !== 0 && (
                            <p className="text-xs font-bold text-[#c7a8ff]">
                              {t.diamonds_delta > 0 ? "+" : ""}
                              {t.diamonds_delta.toLocaleString()} pts
                            </p>
                          )}
                          <p className="text-[9px] text-white/45">
                            {new Date(t.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </TheatreRow>
                  );
                })}
              </div>
            ) : (
              <p className="py-6 text-center text-xs text-white/50">
                No transactions yet — recharge to get started
              </p>
            )}
          </section>
        </TheatreCard>
      </AppShell>
      <BottomNav />
    </>
  );
}
