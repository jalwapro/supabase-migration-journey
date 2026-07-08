import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Coins,
  Diamond,
  ArrowDownToLine,
  ArrowUpFromLine,
  Gift,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { formatCompact } from "@/lib/utils";

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
      <AppShell title="Wallet" subtitle="Coins & diamonds">
        <div className="space-y-4 px-4 pt-4 pb-8">
          <div className="glass rounded-3xl bg-gradient-to-br from-[color:var(--gold)]/20 via-[color:var(--primary)]/15 to-transparent p-5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Coins balance
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Coins className="h-8 w-8 text-[color:var(--gold)]" />
              <span className="text-4xl font-black" title={(profile?.coins ?? 0).toLocaleString()}>
                {formatCompact(profile?.coins ?? 0)}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Link
                to="/recharge"
                className="flex-1 rounded-full bg-primary py-2.5 text-center text-sm font-bold text-primary-foreground"
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
                className="rounded-full border border-border bg-card/60 px-4 py-2.5 text-sm font-semibold"
              >
                History
              </button>
            </div>
          </div>

          <div className="glass rounded-3xl bg-gradient-to-br from-[color:var(--secondary)]/25 via-[color:var(--primary)]/10 to-transparent p-5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Diamonds earned
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Diamond className="h-8 w-8 text-[color:var(--secondary)]" />
              <span className="text-4xl font-black">
                {(profile?.diamonds ?? 0).toLocaleString()}
              </span>
            </div>
            <button
              onClick={() => toast("Withdraw flow ships in Phase 5")}
              className="mt-4 w-full rounded-full border border-[color:var(--secondary)]/60 py-2.5 text-sm font-bold text-[color:var(--secondary)]"
            >
              <ArrowUpFromLine className="mr-1.5 inline h-4 w-4" />
              Withdraw
            </button>
          </div>

          <p className="pt-1 text-center text-[10px] text-muted-foreground">
            60% of every gift you receive as a host → diamonds
          </p>

          <section id="wallet-history">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Transactions
            </h2>
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
                    <div
                      key={t.id}
                      className="flex items-center gap-3 rounded-xl bg-card/60 p-3"
                    >
                      <div
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                          positive ? "bg-emerald-500/20" : "bg-red-500/20"
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 ${
                            positive ? "text-emerald-400" : "text-red-400"
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold capitalize">
                          {t.kind.replace(/_/g, " ")}
                        </p>
                        {t.note && (
                          <p className="truncate text-[11px] text-muted-foreground">
                            {t.note}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {t.coins_delta !== 0 && (
                          <p
                            className={`text-sm font-black ${
                              t.coins_delta > 0 ? "text-[color:var(--gold)]" : "text-red-400"
                            }`}
                          >
                            {t.coins_delta > 0 ? "+" : ""}
                            {t.coins_delta.toLocaleString()}
                          </p>
                        )}
                        {t.diamonds_delta !== 0 && (
                          <p className="text-xs font-bold text-[color:var(--secondary)]">
                            {t.diamonds_delta > 0 ? "+" : ""}
                            {t.diamonds_delta.toLocaleString()} 💎
                          </p>
                        )}
                        <p className="text-[9px] text-muted-foreground">
                          {new Date(t.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                No transactions yet — recharge to get started
              </p>
            )}
          </section>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
