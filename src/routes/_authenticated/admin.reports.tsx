import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Flag, User as UserIcon, DoorOpen } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  component: ReportsAdmin,
});

type Report = {
  id: string;
  reporter_id: string;
  reporter_username: string | null;
  reporter_avatar: string | null;
  reported_user_id: string | null;
  reported_username: string | null;
  reported_avatar: string | null;
  room_id: string | null;
  room_title: string | null;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
};

function ReportsAdmin() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "resolved" | "dismissed">("pending");

  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [tab]);

  const list = useQuery({
    queryKey: ["admin_reports", tab, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_reports", {
        p_status: tab,
        p_limit: 50,
        p_offset: (page - 1) * 50,
      });
      if (error) throw error;
      return (data ?? []) as Report[];
    },
    staleTime: 10_000,
  });

  useEffect(() => {
    let timer: number | undefined;
    const ch = supabase
      .channel("admin-reports")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_reports" }, () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void qc.invalidateQueries({ queryKey: ["admin_reports", tab] }), 400);
      })
      .subscribe();
    return () => {
      window.clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [qc, tab]);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.rpc("set_report_status", { _id: id, _status: status });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin_reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nameOf = (id: string | null | undefined, username?: string | null) => {
    if (!id) return "—";
    return username ? `@${username}` : id.slice(0, 8);
  };
  const roomOf = (id: string | null | undefined, title?: string | null) => {
    if (!id) return null;
    return title ?? id.slice(0, 8);
  };

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
          {list.data?.map((r) => {
            const roomLabel = roomOf(r.room_id, r.room_title);
            return (
              <div key={r.id} className="glass rounded-2xl p-3">
                <div className="flex items-start gap-2">
                  <Flag className="mt-0.5 h-4 w-4 text-red-400" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{r.reason}</p>
                    {r.details && <p className="mt-1 text-xs text-muted-foreground">{r.details}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-muted-foreground">
                        by {nameOf(r.reporter_id, r.reporter_username)}
                      </span>
                      {r.reported_user_id && (
                        <Link
                          to="/u/$userId"
                          params={{ userId: r.reported_user_id }}
                          className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 font-bold text-red-300 hover:bg-red-500/25"
                        >
                          <UserIcon className="h-3 w-3" /> {nameOf(r.reported_user_id, r.reported_username)}
                        </Link>
                      )}
                      {r.room_id && roomLabel && (
                        <Link
                          to="/room/$roomId"
                          params={{ roomId: r.room_id }}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-bold text-primary hover:bg-primary/25"
                        >
                          <DoorOpen className="h-3 w-3" /> {roomLabel}
                        </Link>
                      )}
                    </div>
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
            );
          })}
          {list.data?.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No reports</p>}
          <div className="flex items-center justify-between gap-2 pt-2">
            <span className="text-[11px] text-muted-foreground">Page {page} · 50 reports max</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || list.isFetching} className="rounded-full border px-3 py-1.5 text-xs disabled:opacity-40">Previous</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={(list.data?.length ?? 0) < 50 || list.isFetching} className="rounded-full border px-3 py-1.5 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
