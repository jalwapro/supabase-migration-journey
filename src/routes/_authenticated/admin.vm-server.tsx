import { createFileRoute } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import AdminVmServerMonitor from "@/components/admin/AdminVmServerMonitor";

export const Route = createFileRoute("/_authenticated/admin/vm-server")({
  component: VmServerPage,
});

function VmServerPage() {
  return (
    <>
      <AdminPageHeader title="VM Server" subtitle="Oracle Cloud VM and LiveKit v1.13.6 capacity monitoring" />
      <AdminVmServerMonitor />
    </>
  );
}
