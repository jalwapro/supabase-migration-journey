import { createFileRoute } from "@tanstack/react-router";
import CpLevelManager from "@/components/CP/CpLevelManager";

export const Route = createFileRoute("/_authenticated/admin/cp")({
  component: CpAdminPage,
});

function CpAdminPage() {
  return <CpLevelManager />;
}
