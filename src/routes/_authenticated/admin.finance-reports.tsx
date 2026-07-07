import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";

export const Route = createFileRoute("/_authenticated/admin/finance-reports")({
  component: () => (
    <AdminPlaceholder
      title="Finance Reports"
      subtitle="Recharge, gifting and payout analytics"
      bullets={[
        "Schema live on Supabase",
        "Row-level policies configured",
        "UI wiring queued for next phase",
      ]}
    />
  ),
});
