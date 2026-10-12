import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/agency-approvals")({
  component: SuperAgentApprovalRoute,
});

type Withdrawal = {
  id: string;
  user_id: string;
  sub_agent_id: string;
  super_agent_id: string;
  amount: number;
  fiat_currency: string;
  fiat_amount: number;
  status: "pending_payment" | "pending_approval" | "completed" | "rejected" | "cancelled";
  payout_screenshot_path: string | null;
  payout_reference: string | null;
  sub_agent_submitted_at: string | null;
  created_at: string;
  signed_proof_url: string | null;
};

type QueryResult<T> = { data: T | null; error: { message: string } | null };
type QueryBuilder<T> = PromiseLike<QueryResult<T>> & {
  select: (columns: string) => QueryBuilder<T>;
  eq: (column: string, value: unknown) => QueryBuilder<T>;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder<T>;
};
const p2pClient = supabase as unknown as {
  from: (table: string) => QueryBuilder<Withdrawal[]>;
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function SuperAgentApprovalRoute() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  const role = useQuery({
    queryKey: ["p2p-profile-role", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("p2p_profiles" as never)
        .select("role,active")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as { role: string; active: boolean } | null;
    },
  });

  const withdrawals = useQuery({
    queryKey: ["p2p-super-agent-withdrawals", user?.id],
    enabled: !!user?.id && role.data?.role === "super_agent" && role.data.active,
    queryFn: async () => {
      const { data, error } = await p2pClient
        .from("p2p_diamond_withdrawals")
        .select("id,user_id,sub_agent_id,super_agent_id,amount,fiat_currency,fiat_amount,status,payout_screenshot_path,payout_reference,sub_agent_submitted_at,created_at")
        .eq("super_agent_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      return Promise.all(rows.map(async (row) => {
        if (!row.payout_screenshot_path) return { ...row, signed_proof_url: null };
        const { data: signed, error: signedError } = await supabase.storage
          .from("payout_screenshots")
          .createSignedUrl(row.payout_screenshot_path, 90);
        if (signedError) return { ...row, signed_proof_url: null };
        return { ...row, signed_proof_url: signed.signedUrl };
      }));
    },
    refetchInterval: 30_000,
  });

  const approve = useMutation({
    mutationFn: async (withdrawalId: string) => {
      const { error } = await p2pClient.rpc("p2p_approve_diamond_withdrawal", {
        p_withdrawal_id: withdrawalId,
        p_request_key: crypto.randomUUID(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Withdrawal approved; diamonds released to Sub-Agent inventory.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["p2p-super-agent-withdrawals"] }),
        qc.invalidateQueries({ queryKey: ["p2p-wallet"] }),
      ]);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      void qc.invalidateQueries({ queryKey: ["p2p-super-agent-withdrawals"] });
    },
  });

  const reject = useMutation({
    mutationFn: async ({ withdrawalId, reason }: { withdrawalId: string; reason: string }) => {
      const { error } = await p2pClient.rpc("p2p_reject_diamond_withdrawal", {
        p_withdrawal_id: withdrawalId,
        p_reason: reason,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Withdrawal rejected; diamonds returned to the user's available balance.");
      await qc.invalidateQueries({ queryKey: ["p2p-super-agent-withdrawals"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!user) return <AppShell title="Agency approvals"><main className="p-5">Please sign in to continue.</main></AppShell>;
  if (role.isLoading) return <AppShell title="Agency approvals"><main className="grid min-h-56 place-items-center"><Loader2 className="animate-spin" /></main></AppShell>;
  if (role.data?.role !== "super_agent" || !role.data.active) {
    return <AppShell title="Agency approvals"><main className="mx-auto max-w-xl p-5"><section className="rounded-2xl border border-border bg-card p-5"><ShieldCheck className="mb-3 h-8 w-8 text-amber-400" /><h1 className="text-lg font-black">Super Agent access required</h1><p className="mt-2 text-sm text-muted-foreground">This page is only available to active Super Agents. Database policies and approval RPCs enforce the same restriction.</p></section></main></AppShell>;
  }

  const rows = withdrawals.data ?? [];
  const pending = rows.filter((row) => row.status === "pending_approval");
  const waitingProof = rows.filter((row) => row.status === "pending_payment");

  return <AppShell title="Super Agent approvals" subtitle="Review payment proof before diamonds are released">
    <main className="mx-auto w-full max-w-6xl space-y-5 px-3 pb-24 pt-5 sm:px-5">
      <section className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-zinc-950 via-card to-amber-950/30 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">JALWA · MASTER AGENCY</p><h1 className="mt-1 text-2xl font-black">Diamond withdrawal approvals</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Verify the Sub-Agent's payment screenshot and payout details. Approval is the only action that releases escrowed diamonds.</p></div>
          <button aria-label="Refresh withdrawals" onClick={() => void withdrawals.refetch()} className="rounded-xl border border-border bg-background p-3"><RefreshCw className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric label="Awaiting approval" value={pending.length.toLocaleString()} />
          <Metric label="Awaiting proof" value={waitingProof.length.toLocaleString()} />
          <Metric label="Diamonds under review" value={pending.reduce((sum, row) => sum + Number(row.amount), 0).toLocaleString()} />
        </div>
      </section>

      {withdrawals.isLoading ? <div className="grid min-h-40 place-items-center"><Loader2 className="animate-spin" /></div> : null}
      {withdrawals.isError ? <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">Could not load agency withdrawals. {withdrawals.error.message}</section> : null}
      {!withdrawals.isLoading && !withdrawals.isError && rows.length === 0 ? <section className="rounded-2xl border border-border bg-card p-8 text-center"><ShieldCheck className="mx-auto h-9 w-9 text-muted-foreground" /><h2 className="mt-3 font-bold">No withdrawal requests</h2><p className="mt-1 text-sm text-muted-foreground">Requests assigned to your agency will appear here.</p></section> : null}

      <section className="space-y-3">
        {rows.map((row) => {
          const busy = approve.isPending || reject.isPending;
          return <article key={row.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="flex flex-wrap items-center gap-2"><h2 className="font-black">{Number(row.amount).toLocaleString()} diamonds</h2><Status status={row.status} /></div><p className="mt-1 text-sm text-muted-foreground">Payout: {row.fiat_currency} {Number(row.fiat_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p><p className="mt-1 text-xs text-muted-foreground">User: {row.user_id} · Sub-Agent: {row.sub_agent_id}</p><p className="mt-1 text-xs text-muted-foreground">Created: {new Date(row.created_at).toLocaleString()}</p>{row.payout_reference ? <p className="mt-2 text-sm">Payment reference: <span className="font-semibold">{row.payout_reference}</span></p> : null}</div>
              {row.signed_proof_url ? <a href={row.signed_proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-bold"><ExternalLink className="h-4 w-4" /> View proof</a> : row.payout_screenshot_path ? <span className="text-xs text-muted-foreground">Proof preview unavailable</span> : <span className="text-xs text-muted-foreground">Payment proof not submitted</span>}
            </div>
            {row.status === "pending_approval" ? <div className="mt-4 border-t border-border pt-4">
              <label className="block text-xs font-bold text-muted-foreground">Rejection reason (required only to reject)</label>
              <textarea value={rejectionReasons[row.id] ?? ""} onChange={(event) => setRejectionReasons((prev) => ({ ...prev, [row.id]: event.target.value }))} maxLength={1000} rows={2} placeholder="Explain why the payment proof is invalid..." className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-amber-400" />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button disabled={busy || (rejectionReasons[row.id] ?? "").trim().length < 3} onClick={() => reject.mutate({ withdrawalId: row.id, reason: rejectionReasons[row.id].trim() })} className="inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/40 px-4 py-3 text-sm font-bold text-destructive disabled:opacity-50"><XCircle className="h-4 w-4" /> Reject and return diamonds</button>
                <button disabled={busy || !row.signed_proof_url} onClick={() => { if (window.confirm("Confirm you verified the real fiat payment? This releases diamonds to the Sub-Agent and cannot be reversed automatically.")) approve.mutate(row.id); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-zinc-950 disabled:opacity-50">{approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve payout</button>
              </div>
            </div> : null}
          </article>;
        })}
      </section>
    </main>
  </AppShell>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-zinc-400">{label}</p><p className="mt-1 text-2xl font-black text-amber-300">{value}</p></div>;
}

function Status({ status }: { status: Withdrawal["status"] }) {
  const styles: Record<Withdrawal["status"], string> = {
    pending_payment: "border-slate-400/20 bg-slate-400/10 text-slate-300",
    pending_approval: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    completed: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    rejected: "border-red-400/20 bg-red-400/10 text-red-300",
    cancelled: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  };
  return <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wide ${styles[status]}`}>{status.replaceAll("_", " ")}</span>;
}
