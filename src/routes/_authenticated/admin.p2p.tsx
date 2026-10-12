import { createFileRoute } from "@tanstack/react-router";
import P2PResolution from "@/pages/admin/P2PResolution";

export const Route = createFileRoute("/_authenticated/admin/p2p")({ component: P2PResolution });
