import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  component: () => (
    <AdminPlaceholder
      title="Report Center"
      subtitle="User-submitted abuse reports"
      bullets={[
        "Schema live on Supabase",
        "Row-level policies configured",
        "UI wiring queued for next phase",
      ]}
    />
  ),
});
