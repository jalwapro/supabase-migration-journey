import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { LudoReplayViewer } from "@/components/games/LudoReplayViewer";

export const Route = createFileRoute("/_authenticated/admin/ludo-replays")({
  component: AdminLudoReplays,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-red-400">Failed to load: {error?.message}</div>
  ),
});

function AdminLudoReplays() {
  const [userId, setUserId] = useState("");
  const [applied, setApplied] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Ludo Replays"
        subtitle="Inspect any match turn-by-turn: dice rolls, moves and server validation verdicts."
      />
      <div className="flex gap-2">
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Filter by player user id (optional)"
          className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm"
        />
        <button
          onClick={() => setApplied(userId.trim() || null)}
          className="rounded-xl bg-[color:var(--primary)] px-4 py-2 text-sm font-bold text-white"
        >
          Apply
        </button>
      </div>
      <LudoReplayViewer adminMode userId={applied} key={applied ?? "all"} />
    </div>
  );
}
