import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";

export const Route = createFileRoute("/_authenticated/admin/support")({
  component: () => (
    <AdminPlaceholder
      title="Support Center"
      subtitle="User tickets and replies"
      bullets={[
        "Schema live on Supabase",
        "Row-level policies configured",
        "UI wiring queued for next phase",
      ]}
    />
  ),
});
