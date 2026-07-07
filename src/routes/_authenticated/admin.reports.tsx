import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Flag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  component: ReportsAdmin,
});

type Report = {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  room_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
};

function ReportsAdmin() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "resolved" | "dismissed">("pending");

  const list = useQuery({
    queryKey: ["admin_reports", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_reports")
        .select("*")
        .eq("status", tab)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Report[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("user_reports").update({ status }).eq("id", id);
      if (error) throw error;
      await supabase.from("admin_logs").insert({ action: `report_${status}`, target: id });
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin_reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader title="Report Center" subtitle="User & room abuse reports" />
      <div className="mb-3 flex gap-2">
        {(["pending", "resolved", "dismissed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${tab === s ? "bg-primary text-primary-foreground" : "bg-card/60 text-muted-foreground"}`}
          >
            {s}
          </button>
        ))}
      </div>
      {list.isLoading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {list.data?.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-3">
              <div className="flex items-start gap-2">
                <Flag className="mt-0.5 h-4 w-4 text-red-400" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{r.reason}</p>
                  {r.details && <p className="mt-1 text-xs text-muted-foreground">{r.details}</p>}
                  <p className="mt-1 truncate text-[10px] text-muted-foreground">
                    reporter: {r.reporter_id.slice(0, 8)} · target user: {r.reported_user_id?.slice(0, 8) ?? "—"} · room: {r.room_id?.slice(0, 8) ?? "—"}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              {tab === "pending" && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setStatus.mutate({ id: r.id, status: "resolved" })}
                    className="flex-1 rounded-full bg-emerald-500/20 py-1.5 text-xs font-bold text-emerald-400"
                  >
                    Resolve
                  </button>
                  <button
                    onClick={() => setStatus.mutate({ id: r.id, status: "dismissed" })}
                    className="flex-1 rounded-full bg-white/10 py-1.5 text-xs font-bold text-muted-foreground"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
          {list.data?.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No reports</p>}
        </div>
      )}
    </>
  );
}
