import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy finance administration is superseded by P2P Master-Agency.
export const Route = createFileRoute("/_authenticated/admin/recharge")({ beforeLoad: () => { throw redirect({ to: "/p2p-agency" }); }, component: () => null });
