import { createFileRoute } from "@tanstack/react-router";
import { CpAdminHub } from "@/components/CP/admin/CpAdminHub";

export const Route = createFileRoute("/_authenticated/admin/cp")({
  component: CpAdminPage,
});

function CpAdminPage() {
  return <CpAdminHub />;
}
