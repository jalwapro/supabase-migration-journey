import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { AgentMarketplace } from "@/components/p2p/AgentMarketplace";

export const Route = createFileRoute("/_authenticated/p2p")({ component: Page });
function Page() {
  return <><AppShell title="P2P Coin Market" right={<Link to="/p2p/agent" className="rounded-full border border-border px-3 py-2 text-xs font-bold">Agent dashboard</Link>}><AgentMarketplace/></AppShell><BottomNav/></>;
}
