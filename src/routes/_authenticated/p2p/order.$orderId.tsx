import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { EscrowChat } from "@/components/p2p/EscrowChat";

export const Route = createFileRoute("/_authenticated/p2p/order/$orderId")({ component: Page });
function Page() {
  const { orderId } = Route.useParams();
  return <><AppShell title="P2P Escrow"><EscrowChat orderId={orderId}/></AppShell><BottomNav/></>;
}
