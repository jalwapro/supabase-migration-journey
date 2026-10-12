import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { AgentDashboard } from "@/components/p2p/AgentDashboard";
import { CoinAgentHub } from "@/components/coin-agent/CoinAgentHub";
import { CoinSellerMarketplace } from "@/routes/_authenticated/coin-sellers";

export const Route = createFileRoute("/_authenticated/p2p/agent")({ component: Page });

function Page() {
  return <>
    <AppShell title="Coin Agent Control Panel">
      <main className="mx-auto w-full max-w-6xl space-y-5 px-3 pb-28 pt-4 sm:px-5">
        <section className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-zinc-950 via-card to-amber-950/30 p-4 sm:p-5">
          <p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">JALWA · Merchant workspace</p>
          <h1 className="mt-1 text-2xl font-black">Coin Agent Control Panel</h1>
          <p className="mt-2 text-sm text-muted-foreground">Diamond buying, your price, coin inventory, customer transfers, payment methods, orders and settlements — all in one place.</p>
          <nav aria-label="Coin Agent sections" className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <a href="#coin-agent-dashboard" className="shrink-0 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-200">Diamond & price</a>
            <a href="#coin-agent-inventory" className="shrink-0 rounded-full border border-border bg-background/70 px-3 py-2 text-xs font-bold">Coin inventory</a>
            <a href="#coin-agent-p2p" className="shrink-0 rounded-full border border-border bg-background/70 px-3 py-2 text-xs font-bold">P2P orders</a>
          </nav>
        </section>
        <section aria-label="Diamond trading and agent settings" className="scroll-mt-20">
          <CoinAgentHub />
        </section>
        <section id="coin-agent-inventory" aria-label="Coin inventory and customer transfers" className="scroll-mt-20 rounded-2xl border border-border bg-card p-3 sm:p-4">
          <div className="mb-3">
            <h2 className="text-lg font-black">Coin inventory & customer transfers</h2>
            <p className="mt-1 text-xs text-muted-foreground">Check available stock, transfer coins to a buyer's JALWA ID and review seller transactions.</p>
          </div>
          <CoinSellerMarketplace embedded />
        </section>
        <section id="coin-agent-p2p" aria-label="P2P agent settings and orders" className="scroll-mt-20 rounded-2xl border border-border bg-card p-2 sm:p-3">
          <div className="px-2 pt-2">
            <h2 className="text-lg font-black">P2P orders & payment settings</h2>
            <p className="mt-1 text-xs text-muted-foreground">Manage P2P rates, payment channels, WhatsApp approval and orders.</p>
          </div>
          <AgentDashboard />
        </section>
      </main>
    </AppShell>
    <BottomNav />
  </>;
}
