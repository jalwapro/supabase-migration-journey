import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coins, Loader2, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type RequestRow = {
  id: string; agent_id: string; requested_amount: number; approved_amount: number | null;
  status: "pending" | "approved" | "rejected" | "cancelled"; agent_note: string | null;
  admin_note: string | null; created_at: string;
};
type AdminOverview = {
  treasury?: { available_coins: number; total_issued: number };
  settings?: { p2p_user_transfers_enabled: boolean; cash_withdrawals_enabled: boolean; max_p2p_transfer: number; daily_p2p_limit: number };
  pending_inventory_requests?: number; pending_withdrawals?: number; posted_transactions?: number;
  recent_transactions?: Array<{ id: string; kind: string; status: string; created_at: string; metadata: Record<string, unknown> }>;
};

// The generated client types may lag a live schema migration. Keep calls typed at this boundary.
const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>;
};

export function CoinInventoryRequests() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("50000");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [issueAmount, setIssueAmount] = useState("");
  const [issueReason, setIssueReason] = useState("");
  const [p2pEnabled, setP2pEnabled] = useState(false);

  const roleQuery = useQuery({
    queryKey: ["coin-economy-role", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await db.from("user_roles").select("role").eq("user_id", user!.id);
      if (error) throw error;
      const roles = (data ?? []).map((r: { role: string }) => r.role);
      return { isAdmin: roles.some((r: string) => ["admin", "super_admin"].includes(r)), isSuperAdmin: roles.includes("super_admin") };
    },
    staleTime: 60_000,
  });
  const isAdmin = !!roleQuery.data?.isAdmin;
  const isSuperAdmin = !!roleQuery.data?.isSuperAdmin;

  const requestsQuery = useQuery({
    queryKey: ["coin-inventory-requests", user?.id, isAdmin],
    enabled: !!user?.id && !roleQuery.isLoading,
    queryFn: async () => {
      let q = db.from("coin_inventory_requests").select("*").order("created_at", { ascending: false }).limit(50);
      if (!isAdmin) q = q.eq("agent_id", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as RequestRow[];
    },
    refetchInterval: 15_000,
  });

  const overviewQuery = useQuery({
    queryKey: ["coin-economy-overview"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await db.rpc("coin_economy_admin_action", { p_action: "OVERVIEW", p_payload: {} });
      if (error) throw new Error(error.message);
      return data as AdminOverview;
    },
    refetchInterval: 15_000,
  });

  useEffect(() => {
    setP2pEnabled(Boolean(overviewQuery.data?.settings?.p2p_user_transfers_enabled));
  }, [overviewQuery.data?.settings?.p2p_user_transfers_enabled]);

  const pending = useMemo(() => (requestsQuery.data ?? []).filter(r => r.status === "pending"), [requestsQuery.data]);

  async function runInventoryAction(action: "REQUEST" | "APPROVE" | "REJECT", payload: Record<string, unknown>) {
    setBusy(action + String(payload.request_id ?? ""));
    try {
      const { data, error } = await db.rpc("coin_inventory_request_action", { p_action: action, p_payload: payload });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(String(data.error));
      toast.success(action === "REQUEST" ? "Inventory request submitted to admin" : action === "APPROVE" ? "Inventory allocated from treasury" : "Inventory request rejected");
      await Promise.all([qc.invalidateQueries({ queryKey: ["coin-inventory-requests"] }), qc.invalidateQueries({ queryKey: ["coin-economy-overview"] }), qc.invalidateQueries({ queryKey: ["my_coin_seller_inventory"] })]);
    } catch (e) { toast.error((e as Error).message || "Coin inventory action failed"); }
    finally { setBusy(""); }
  }

  async function fundTreasury() {
    const coins = Number(issueAmount);
    if (!Number.isSafeInteger(coins) || coins < 1 || coins > 1_000_000_000 || issueReason.trim().length < 5) {
      toast.error("Enter a valid whole coin amount and an issuance reason (at least 5 characters).");
      return;
    }
    setBusy("fund");
    try {
      const { data, error } = await db.rpc("coin_economy_admin_action", { p_action: "FUND_TREASURY", p_payload: { coins, reason: issueReason.trim() } });
      if (error) throw new Error(error.message);
      toast.success(`Treasury funded: ${coins.toLocaleString()} coins`);
      setIssueAmount(""); setIssueReason("");
      await qc.invalidateQueries({ queryKey: ["coin-economy-overview"] });
    } catch (e) { toast.error((e as Error).message || "Treasury funding failed"); }
    finally { setBusy(""); }
  }

  async function saveP2PSetting() {
    setBusy("settings");
    try {
      const { error } = await db.rpc("coin_economy_admin_action", { p_action: "SET_FEATURES", p_payload: { p2p_user_transfers_enabled: p2pEnabled } });
      if (error) throw new Error(error.message);
      toast.success(p2pEnabled ? "User-to-user transfers enabled" : "User-to-user transfers disabled");
      await qc.invalidateQueries({ queryKey: ["coin-economy-overview"] });
    } catch (e) { toast.error((e as Error).message || "Could not save transfer setting"); }
    finally { setBusy(""); }
  }

  if (!user) return null;
  return <div className="space-y-4">
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2"><Wallet className="h-5 w-5 text-amber-400"/><h2 className="text-lg font-black">Coin inventory requests</h2></div>
      <p className="mt-1 text-xs text-muted-foreground">Request stock from the central treasury. Admin approval transfers existing treasury inventory; it does not silently mint coins.</p>
      {!isAdmin && <div className="mt-4 space-y-2">
        <label className="block text-xs font-semibold">Requested coins</label>
        <input inputMode="numeric" type="number" min="1" max="1000000000" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full rounded-xl border border-border bg-background p-3 text-sm"/>
        <textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={500} placeholder="Optional note for admin" className="w-full rounded-xl border border-border bg-background p-3 text-sm"/>
        <button disabled={!!busy || !Number.isSafeInteger(Number(amount)) || Number(amount)<1} onClick={()=>void runInventoryAction("REQUEST",{requested_amount:Number(amount),note})} className="w-full rounded-xl bg-primary p-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy==="REQUEST"?"Submitting…":"Request inventory"}</button>
      </div>}
      <div className="mt-4 space-y-2">
        {requestsQuery.isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin"/> : requestsQuery.isError ? <p className="text-xs text-destructive">Could not load inventory requests.</p> : requestsQuery.data?.length ? requestsQuery.data.map(r=><div key={r.id} className="rounded-xl border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm">{Number(r.approved_amount ?? r.requested_amount).toLocaleString()} coins</b><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase">{r.status}</span></div>
          <p className="mt-1 text-xs text-muted-foreground">{isAdmin ? `Agent ${r.agent_id.slice(0,8)} · ` : ""}{new Date(r.created_at).toLocaleString()}</p>
          {r.agent_note && <p className="mt-1 text-xs">{r.agent_note}</p>}{r.admin_note && <p className="mt-1 text-xs text-muted-foreground">Admin: {r.admin_note}</p>}
          {isAdmin && r.status==="pending" && <div className="mt-2 flex gap-2"><button disabled={!!busy} onClick={()=>void runInventoryAction("APPROVE",{request_id:r.id,approved_amount:r.requested_amount,note:"Approved"})} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Approve full request</button><button disabled={!!busy} onClick={()=>void runInventoryAction("REJECT",{request_id:r.id,note:"Rejected by admin"})} className="rounded-lg border border-border px-3 py-2 text-xs font-bold disabled:opacity-50">Reject</button></div>}
        </div>) : <p className="rounded-xl bg-background p-3 text-xs text-muted-foreground">No inventory requests yet.</p>}
      </div>
    </section>

    {isAdmin && <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-amber-400"/><h2 className="text-lg font-black">Economy controls</h2></div>
      {overviewQuery.isLoading ? <Loader2 className="mt-3 h-5 w-5 animate-spin"/> : <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-background p-3"><p className="text-xs text-muted-foreground">Treasury inventory</p><p className="mt-1 text-lg font-black">{Number(overviewQuery.data?.treasury?.available_coins ?? 0).toLocaleString()}</p></div>
        <div className="rounded-xl bg-background p-3"><p className="text-xs text-muted-foreground">Total issued to treasury</p><p className="mt-1 text-lg font-black">{Number(overviewQuery.data?.treasury?.total_issued ?? 0).toLocaleString()}</p></div>
        <div className="rounded-xl bg-background p-3"><p className="text-xs text-muted-foreground">Pending inventory requests</p><p className="mt-1 text-lg font-black">{overviewQuery.data?.pending_inventory_requests ?? 0}</p></div>
        <div className="rounded-xl bg-background p-3"><p className="text-xs text-muted-foreground">Posted economy records</p><p className="mt-1 text-lg font-black">{overviewQuery.data?.posted_transactions ?? 0}</p></div>
      </div>}
      {isSuperAdmin && <div className="mt-4 space-y-2 rounded-xl border border-amber-400/20 p-3">
        <h3 className="text-sm font-bold">Super Admin — treasury issuance</h3>
        <p className="text-xs text-muted-foreground">Only issue coins after an authorized supply/funding decision. Every issuance is recorded in admin logs.</p>
        <input inputMode="numeric" type="number" min="1" max="1000000000" value={issueAmount} onChange={e=>setIssueAmount(e.target.value)} placeholder="Whole coins to issue" className="w-full rounded-lg border border-border bg-background p-3 text-sm"/>
        <textarea value={issueReason} onChange={e=>setIssueReason(e.target.value)} maxLength={500} placeholder="Reason / authorization reference (required)" className="w-full rounded-lg border border-border bg-background p-3 text-sm"/>
        <button disabled={!!busy} onClick={()=>void fundTreasury()} className="w-full rounded-lg bg-amber-400 p-3 text-sm font-black text-black disabled:opacity-50">{busy==="fund"?"Processing…":"Issue coins to treasury"}</button>
      </div>}
      <div className="mt-4 rounded-xl border border-border p-3">
        <label className="flex items-center justify-between gap-3 text-sm font-semibold"><span>Enable user-to-user P2P transfers</span><input type="checkbox" checked={p2pEnabled} onChange={e=>setP2pEnabled(e.target.checked)}/></label>
        <p className="mt-1 text-xs text-muted-foreground">Off by default. This setting only applies to the secure P2P RPC and does not enable cash withdrawal.</p>
        <button disabled={!!busy} onClick={()=>void saveP2PSetting()} className="mt-2 w-full rounded-lg border border-border p-2 text-xs font-bold disabled:opacity-50">Save transfer policy</button>
      </div>
      <button onClick={()=>{void qc.invalidateQueries({queryKey:["coin-economy-overview"]});void qc.invalidateQueries({queryKey:["coin-inventory-requests"]});}} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border p-2 text-xs font-bold"><RefreshCw className="h-3.5 w-3.5"/>Refresh economy</button>
    </section>}
  </div>;
}
