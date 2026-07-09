import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/withdrawals")({
  component: WithdrawalsAdmin,
});

type Row = {
  id: string;
  user_id: string;
  diamonds: number;
  amount_pkr: number;
  method: string;
  account_number: string | null;
  account_name: string | null;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  created_at: string;
};

function WithdrawalsAdmin() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");

  const list = useQuery({
    queryKey: ["admin_withdrawals", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("status", tab)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const act = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: "approved" | "rejected"; note?: string }) => {
      // Use RPCs so diamonds are actually paid out / refunded atomically.
      if (status === "approved") {
        const { error } = await supabase.rpc("approve_withdrawal", { _request_id: id });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("reject_withdrawal", { _request_id: id, _note: note ?? null });
        if (error) throw error;
      }
      const { error: logErr } = await supabase
        .from("admin_logs")
        .insert({ action: `withdrawal_${status}`, target: id });
      if (logErr) console.warn("[admin_logs]", logErr.message);
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin_withdrawals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader title="Withdrawals" subtitle="Host payout requests approval queue" />
      <div className="mb-3 flex gap-2">
        {(["pending", "approved", "rejected"] as const).map((s) => (
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">💎 {r.diamonds.toLocaleString()}</span>
                <span className="rounded-full bg-[color:var(--gold)]/15 px-2 py-0.5 text-[10px] font-bold text-[color:var(--gold)]">
                  PKR {Number(r.amount_pkr).toLocaleString()}
                </span>
                <span className="rounded-full bg-card/60 px-2 py-0.5 text-[10px] uppercase">{r.method}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-xs">
                <span className="text-muted-foreground">To:</span> {r.account_name ?? "—"} · {r.account_number ?? "—"}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">User: {r.user_id}</p>
              {r.admin_note && <p className="mt-1 text-[11px] text-muted-foreground">Note: {r.admin_note}</p>}
              {tab === "pending" && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => act.mutate({ id: r.id, status: "approved" })}
                    className="flex-1 rounded-full bg-emerald-500/20 py-1.5 text-xs font-bold text-emerald-400"
                  >
                    <Check className="mr-1 inline h-3 w-3" /> Approve
                  </button>
                  <button
                    onClick={() => {
                      const n = prompt("Rejection reason?") ?? "";
                      if (n !== null) act.mutate({ id: r.id, status: "rejected", note: n });
                    }}
                    className="flex-1 rounded-full bg-red-500/20 py-1.5 text-xs font-bold text-red-400"
                  >
                    <X className="mr-1 inline h-3 w-3" /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
          {list.data?.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">Nothing here</p>}
        </div>
      )}
    </>
  );
}
