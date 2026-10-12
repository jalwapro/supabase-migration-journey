import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy Coin Agent panel is replaced by the single Master-Agency workspace.
export const Route = createFileRoute("/_authenticated/p2p/agent")({
  beforeLoad: () => { throw redirect({ to: "/p2p-agency" }); },
  component: () => null,
});