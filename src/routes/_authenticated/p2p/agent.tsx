import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { SuperCoinAgentPanel } from "@/components/coin-agent/SuperCoinAgentPanel";
import { coinAgentAction } from "@/lib/coin-agent";
import { useAuth } from "@/hooks/useAuth";
import { Crown, Loader2, ShieldAlert, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/p2p/agent")({ component: SuperCoinAgentDashboard });

function SuperCoinAgentDashboard() {
  const { user } = useAuth();
  const role = useQuery({
    queryKey: ["super-coin-agent-dashboard-role", user?.id],
    enabled: !!user?.id,
    queryFn: () => coinAgentAction<{ role?: string }>("ROLE_CONTEXT"),
    staleTime: 15_000,
    retry: false,
  });

  if (!user) {
    return <AppShell title="Super Coin Agent Dashboard"><main className="p-5 text-sm text-muted-foreground">Please sign in first.</main></AppShell>;
  }

  if (role.isLoading) {
    return <AppShell title="Super Coin Agent Dashboard"><main className="flex min-h-[45vh] items-center justify-center gap-3 p-5 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Checking Super Coin Agent access…</main></AppShell>;
  }

  if (role.isError || role.data?.role !== "super_coin_agent") {
    return <AppShell title="Super Coin Agent Dashboard"><main className="mx-auto max-w-xl p-5"><section className="rounded-2xl border border-red-400/20 bg-card p-5"><ShieldAlert className="h-8 w-8 text-red-300" /><h1 className="mt-3 text-lg font-black">Super Coin Agent access required</h1><p className="mt-2 text-sm text-muted-foreground">This dashboard is only available to users assigned the Super Coin Agent role by Admin.</p></section></main></AppShell>;
  }

  return <>
    <AppShell title="Super Coin Agent Dashboard" subtitle="Team management and agent oversight">
      <main className="mx-auto w-full max-w-5xl space-y-5 px-3 pb-28 pt-4 sm:px-5">
        <section className="relative overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-br from-zinc-950 via-card to-amber-950/30 p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-amber-300/30 bg-amber-400/10 text-amber-300"><Crown className="h-7 w-7" /></div>
            <div><p className="text-[10px] font-black uppercase tracking-[.22em] text-amber-300">JALWA · AGENT NETWORK</p><h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">Super Coin Agent</h1><p className="mt-2 text-sm text-muted-foreground">Create and supervise up to five Coin Agents assigned under your account. Each agent's inventory and sales summary appears below.</p></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold"><span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-amber-200"><Users className="h-3.5 w-3.5" /> Team management</span><span className="rounded-full border border-border bg-background/60 px-3 py-2 text-muted-foreground">Maximum 5 child agents</span></div>
        </section>
        <SuperCoinAgentPanel />
      </main>
    </AppShell>
    <BottomNav />
  </>;
}
