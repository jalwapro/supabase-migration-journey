import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { Coins, Diamond, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/wallet")({
  component: WalletPage,
});

function WalletPage() {
  const { profile } = useAuth();
  return (
    <>
      <AppShell title="Wallet" subtitle="Coins & diamonds">
        <div className="space-y-4 px-4 pt-4">
          <div className="glass rounded-3xl bg-gradient-to-br from-[color:var(--gold)]/20 via-[color:var(--primary)]/15 to-transparent p-5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Coins balance
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Coins className="h-8 w-8 text-[color:var(--gold)]" />
              <span className="text-4xl font-black">
                {(profile?.coins ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => toast("Recharge flow ships in Phase 4 💳")}
                className="flex-1 rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground"
              >
                <ArrowDownToLine className="mr-1.5 inline h-4 w-4" />
                Recharge
              </button>
              <button
                onClick={() => toast("History ships in Phase 4")}
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
              onClick={() => toast("Withdraw flow ships in Phase 4")}
              className="mt-4 w-full rounded-full border border-[color:var(--secondary)]/60 py-2.5 text-sm font-bold text-[color:var(--secondary)]"
            >
              <ArrowUpFromLine className="mr-1.5 inline h-4 w-4" />
              Withdraw
            </button>
          </div>

          <p className="pt-2 text-center text-[10px] text-muted-foreground">
            60% of every gift you receive as a host → diamonds
          </p>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
