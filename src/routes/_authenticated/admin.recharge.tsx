import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Check, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/recharge")({
  component: RechargeAdmin,
});

/** Extract "user_id/xxx.png" from a public URL like
 *  https://.../object/public/recharge-proofs/<path>, or from a bare path. */
function extractProofPath(url: string): string | null {
  const marker = "/recharge-proofs/";
  const i = url.indexOf(marker);
  if (i >= 0) return url.slice(i + marker.length).split("?")[0];
  // Already a bare path.
  if (!url.startsWith("http")) return url.replace(/^\/+/, "");
  return null;
}

function ProofThumb({ url }: { url: string }) {
  const [signed, setSigned] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const path = extractProofPath(url);
    if (!path) { setSigned(url); return; }
    (async () => {
      const { data, error } = await supabase.storage
        .from("recharge-proofs")
        .createSignedUrl(path, 60 * 10); // 10 min
      if (!alive) return;
      setSigned(error ? null : data?.signedUrl ?? null);
    })();
    return () => { alive = false; };
  }, [url]);
  if (!signed) {
    return (
      <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-card/60">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <a href={signed} target="_blank" rel="noreferrer" className="shrink-0">
      <img src={signed} alt="proof" className="h-20 w-20 rounded-lg object-cover" />
    </a>
  );
}


type RechargeRow = {
  id: string;
  user_id: string;
  method: string;
  amount_pkr: number;
  coins_expected: number;
  proof_url: string | null;
  sender_name: string | null;
  sender_account: string | null;
  txn_reference: string | null;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  admin_note: string | null;
};

function RechargeAdmin() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");

  const list = useQuery({
    queryKey: ["admin_recharges", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recharge_requests")
        .select("*")
        .eq("status", tab)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as RechargeRow[];
    },
  });

  const act = useMutation({
    mutationFn: async ({ id, approve, note }: { id: string; approve: boolean; note?: string }) => {
      const fn = approve ? "approve_recharge" : "reject_recharge";
      const { error } = await supabase.rpc(fn, { _request_id: id, _admin_note: note ?? null });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.approve ? "Approved & coins credited" : "Rejected");
      qc.invalidateQueries({ queryKey: ["admin_recharges"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader title="Recharge Approvals" subtitle="Verify manual deposits and credit coins" />
      <div className="mb-3 flex gap-1 rounded-full bg-card/60 p-1">
        {(["pending", "approved", "rejected"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-1.5 text-xs font-bold capitalize ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {list.isLoading && (
        <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
      )}
      {list.data?.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No {tab} recharges</p>}
      <div className="space-y-2">
        {list.data?.map((r) => (
          <div key={r.id} className="glass rounded-xl p-3 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">
                  {r.coins_expected.toLocaleString()} coins · Rs {Number(r.amount_pkr).toLocaleString()}
                </p>
                <p className="text-muted-foreground">{r.method} · {new Date(r.created_at).toLocaleString()}</p>
                <p className="mt-1 truncate text-[10px] text-muted-foreground">User: {r.user_id}</p>
                {r.sender_name && <p>From: {r.sender_name}</p>}
                {r.sender_account && <p>Acct: {r.sender_account}</p>}
                {r.txn_reference && <p>Ref: {r.txn_reference}</p>}
                {r.note && <p className="text-muted-foreground">Note: {r.note}</p>}
                {r.admin_note && <p className="mt-1 text-[10px] text-[color:var(--gold)]">Admin: {r.admin_note}</p>}
              </div>
              {r.proof_url ? (
                <ProofThumb url={r.proof_url} />
              ) : (
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-card/60">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
            {tab === "pending" && (
              <div className="mt-2 flex gap-2">
                <button
                  disabled={act.isPending}
                  onClick={() => act.mutate({ id: r.id, approve: true })}
                  className="flex-1 rounded-full bg-emerald-500/90 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  <Check className="mr-1 inline h-3 w-3" /> Approve
                </button>
                <button
                  disabled={act.isPending}
                  onClick={() => {
                    const note = window.prompt("Reason for rejection (optional):") ?? undefined;
                    act.mutate({ id: r.id, approve: false, note });
                  }}
                  className="flex-1 rounded-full bg-red-500/90 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  <X className="mr-1 inline h-3 w-3" /> Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
