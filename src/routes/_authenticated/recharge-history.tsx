import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy recharge history belongs to the retired coin economy.
export const Route = createFileRoute("/_authenticated/recharge-history")({
  beforeLoad: () => { throw redirect({ to: "/p2p-agency" }); },
  component: () => null,
});