import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { AgentDashboard } from "@/components/p2p/AgentDashboard";

export const Route = createFileRoute("/_authenticated/p2p/agent")({ component: Page });
function Page() {
  return <><AppShell title="P2P Agent"><AgentDashboard/></AppShell><BottomNav/></>;
}
