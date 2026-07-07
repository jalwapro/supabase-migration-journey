import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";

export const Route = createFileRoute("/_authenticated/admin/live")({
  component: () => (
    <AdminPlaceholder
      title="Live Management"
      subtitle="Currently live sessions, kick, mute"
      bullets={[
        "Schema live on Supabase",
        "Row-level policies configured",
        "UI wiring queued for next phase",
      ]}
    />
  ),
});
