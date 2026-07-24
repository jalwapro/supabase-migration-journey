import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/custom-themes")({
  component: CustomThemesAdmin,
});

type Row = {
  id: string;
  user_id: string;
  image_url: string;
  coins_paid: number;
  status: "pending" | "approved" | "rejected" | "expired";
  admin_notes: string | null;
  expires_at: string | null;
  approved_at: string | null;
  created_at: string;
  profile?: { username: string | null; avatar: string | null } | null;
};

function CustomThemesAdmin() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const ch = supabase
      .channel("admin-custom-themes")
      .on("postgres_changes", { event: "*", schema: "public", table: "custom_themes" }, () => {
        qc.invalidateQueries({ queryKey: ["admin_custom_themes"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const list = useQuery({
    queryKey: ["admin_custom_themes", filter],
    queryFn: async () => {
      let q = supabase
        .from("custom_themes")
        .select("id,user_id,image_url,coins_paid,status,admin_notes,expires_at,approved_at,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as Row[];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length === 0) return rows;
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,avatar")
        .in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id, { username: p.username, avatar: p.avatar }] as const));
      return rows.map((r) => ({ ...r, profile: map.get(r.user_id) ?? null }));
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("approve_custom_theme", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Approved");
      qc.invalidateQueries({ queryKey: ["admin_custom_themes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async ({ id, r }: { id: string; r: string }) => {
      const { error } = await supabase.rpc("reject_custom_theme", { _id: id, _reason: r || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rejected & coins refunded");
      setRejectId(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["admin_custom_themes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="Custom Themes"
        subtitle="Approve or reject user-uploaded backgrounds"
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-[11px] font-bold capitalize ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-card/60 text-muted-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {list.isLoading && (
        <div className="grid place-items-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.data?.map((r) => (
          <div key={r.id} className="glass overflow-hidden rounded-2xl">
            <a href={r.image_url} target="_blank" rel="noreferrer" className="block">
              <img src={r.image_url} alt="" className="aspect-video w-full object-cover" />
            </a>
            <div className="space-y-2 p-3 text-xs">
              <div className="flex items-center justify-between">
                <p className="font-bold">
                  {r.profile?.username ?? r.user_id.slice(0, 8)}
                </p>
                <span className="rounded-full bg-card/60 px-2 py-0.5 text-[10px] capitalize">
                  {r.status}
                </span>
              </div>
              <p className="text-muted-foreground">
                Paid {r.coins_paid} coins · {new Date(r.created_at).toLocaleString()}
              </p>
              {r.expires_at && r.status === "approved" && (
                <p className="text-emerald-400">Expires {new Date(r.expires_at).toLocaleString()}</p>
              )}
              {r.admin_notes && <p className="text-red-400/80">"{r.admin_notes}"</p>}

              {r.status === "pending" && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => approve.mutate(r.id)}
                    disabled={approve.isPending}
                    className="flex flex-1 items-center justify-center gap-1 rounded-full bg-emerald-500/20 py-1.5 font-bold text-emerald-400"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Approve
                  </button>
                  <button
                    onClick={() => setRejectId(r.id)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-full bg-red-500/20 py-1.5 font-bold text-red-400"
                  >
                    <XCircle className="h-3 w-3" /> Reject
                  </button>
                  <a
                    href={r.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="grid place-items-center rounded-full bg-card/60 px-2"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        ))}
        {list.data?.length === 0 && !list.isLoading && (
          <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
            No submissions
          </p>
        )}
      </div>

      {rejectId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setRejectId(null)}>
          <div className="glass w-full max-w-sm rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 text-sm font-bold">Reject submission</p>
            <textarea
              placeholder="Reason (shown to user, optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[80px] w-full rounded-lg border border-border bg-input p-2 text-xs outline-none"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Coins will be refunded automatically.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setRejectId(null)}
                className="flex-1 rounded-full bg-card/60 py-2 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => reject.mutate({ id: rejectId, r: reason })}
                disabled={reject.isPending}
                className="flex-1 rounded-full bg-red-500 py-2 text-xs font-bold text-white"
              >
                {reject.isPending ? "…" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
