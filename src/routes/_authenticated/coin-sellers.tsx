import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy wallet/coin/diamond screens now route into the independent P2P Master-Agency workspace.
export const Route = createFileRoute("/_authenticated/coin-sellers")({
  beforeLoad: () => { throw redirect({ to: "/p2p-agency" }); },
  component: () => null,
});
