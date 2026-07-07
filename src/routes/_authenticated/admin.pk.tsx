import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";

export const Route = createFileRoute("/_authenticated/admin/pk")({
  component: () => (
    <AdminPlaceholder
      title="PK Management"
      subtitle="Active PK battles, awards, rules"
      bullets={[
        "Schema live on Supabase",
        "Row-level policies configured",
        "UI wiring queued for next phase",
      ]}
    />
  ),
});
