import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Loader2, ShieldCheck, CheckCircle2, XCircle, FileImage, Coins, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { coinAgentAction } from "@/lib/coin-agent";
import { useSignedMediaUrl } from "@/lib/signedMedia";

export function SuperCoinAgentPanel() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"bd_team" | "payout_slips" | "admin_settle">("payout_slips");
  const [targetId, setTargetId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [publicName, setPublicName] = useState("");
  const [selectedSlip, setSelectedSlip] = useState<string | null>(null);
  const selectedSlipUrl = useSignedMediaUrl(selectedSlip);

  // 1. Context: Team of max 5 agents
  const context = useQuery({
    queryKey: ["super-agent-context"],
    queryFn: () => coinAgentAction<{
      role: string;
      country: string;
      child_count: number;
      max_children: number;
      children: Array<{
        user_id: string;
        username: string | null;
        user_code: string | null;
        is_active: boolean;
        available_coins: number;
        diamonds_collected: number;
      }>;
    }>("ROLE_CONTEXT"),
    staleTime: 15000,
  });

  // 2. Pending Payout Slips submitted by Normal Agents
  const pendingSlips = useQuery({
    queryKey: ["super-agent-pending-slips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diamond_payout_requests")
        .select(`
          id,
          diamonds,
          source_type,
          payout_amount,
          currency,
          payout_slip_url,
          payout_method,
          payout_account_number,
          payout_account_name,
          created_at,
          normal_agent:profiles!diamond_payout_requests_normal_agent_id_fkey(username, user_code),
          user:profiles!diamond_payout_requests_user_id_fkey(username, user_code)
        `)
        .eq("status", "slip_submitted")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 10000,
  });

  // 3. Approve / Reject Payout Slip Mutation
  const verifySlipMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: "APPROVE" | "REJECT" }) => {
      const { error } = await supabase.rpc("super_agent_verify_payout_slip", {
        _request_id: requestId,
        _decision: action,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.action === "APPROVE" ? "Slip approved & diamonds credited to agent!" : "Slip rejected.");
      qc.invalidateQueries({ queryKey: ["super-agent-pending-slips"] });
      setSelectedSlip(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // 4. Create Normal Agent (Max 5 limit enforced)
  const createSubAgent = useMutation({
    mutationFn: () =>
      coinAgentAction("SUPER_CREATE_CHILD_AGENT", {
        target_id: targetId.trim(),
        whatsapp_number: whatsapp.replace(/\D/g, ""),
        public_name: publicName.trim() || null,
      }),
    onSuccess: async () => {
      toast.success("Normal Sub-Agent added successfully!");
      setTargetId("");
      setUserSearch("");
      setWhatsapp("");
      setPublicName("");
      await qc.invalidateQueries({ queryKey: ["super-agent-context"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (context.data?.role !== "super_coin_agent") return null;

  return (
    <section className="rounded-3xl border border-amber-500/30 bg-card p-4 sm:p-6 shadow-2xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/30">
            <ShieldCheck className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-black">Super Agent Portal</h2>
            <p className="text-xs text-muted-foreground">Country: {context.data?.country || "Assigned by Admin"}</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 rounded-xl bg-muted/60 p-1">
          <button
            onClick={() => setActiveTab("payout_slips")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === "payout_slips" ? "bg-amber-400 text-black shadow" : "text-muted-foreground"
            }`}
          >
            Payout Slips ({pendingSlips.data?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("bd_team")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === "bd_team" ? "bg-amber-400 text-black shadow" : "text-muted-foreground"
            }`}
          >
            My Agents ({context.data?.child_count}/{context.data?.max_children || 5})
          </button>
          <button
            onClick={() => setActiveTab("admin_settle")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === "admin_settle" ? "bg-amber-400 text-black shadow" : "text-muted-foreground"
            }`}
          >
            Admin Settle
          </button>
        </div>
      </div>

      {/* TAB 1: Payout Slips Review */}
      {activeTab === "payout_slips" && (
        <div className="mt-5 space-y-3">
          <h3 className="text-sm font-bold text-foreground">User Diamond Payout Receipts (Waiting Approval)</h3>
          {pendingSlips.isLoading ? (
            <div className="py-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-amber-400" /></div>
          ) : !pendingSlips.data?.length ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No pending payout slips. Slips submitted by your 5 agents will show here.
            </p>
          ) : (
            pendingSlips.data.map((slip: any) => (
              <div key={slip.id} className="rounded-2xl border border-border bg-background/50 p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-amber-400">Agent: {slip.normal_agent?.username || "Sub-Agent"}</span>
                    <p className="text-sm font-black text-foreground">User: {slip.user?.username} ({Number(slip.diamonds).toLocaleString()} {slip.source_type === "red_diamonds" ? "Red Diamonds" : "Wallet Diamonds"})</p>
                    <p className="text-xs text-emerald-400 font-bold">Paid: {slip.currency} {Number(slip.payout_amount).toLocaleString()} via {slip.payout_method}</p>
                    <p className="text-[11px] text-muted-foreground">Account: {slip.payout_account_number} ({slip.payout_account_name})</p>
                  </div>
                  <button
                    onClick={() => setSelectedSlip(slip.payout_slip_url)}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/80 px-2.5 py-1.5 text-xs font-bold text-foreground"
                  >
                    <FileImage className="h-3.5 w-3.5" /> View Slip
                  </button>
                </div>

                <div className="flex gap-2 pt-2 border-t border-border">
                  <button
                    disabled={verifySlipMutation.isPending}
                    onClick={() => verifySlipMutation.mutate({ requestId: slip.id, action: "APPROVE" })}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2 text-xs font-extrabold text-black disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Approve & Credit Agent
                  </button>
                  <button
                    disabled={verifySlipMutation.isPending}
                    onClick={() => verifySlipMutation.mutate({ requestId: slip.id, action: "REJECT" })}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" /> Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: Sub-Agent (BD) Team */}
      {activeTab === "bd_team" && (
        <div className="mt-5 space-y-4">
          <div className="flex justify-between rounded-xl border border-border bg-background p-3 text-sm">
            <span>Agent Slots Used (Max 5)</span>
            <b className="text-amber-400">{context.data?.child_count} / {context.data?.max_children || 5}</b>
          </div>

          {(context.data?.child_count || 0) < (context.data?.max_children || 5) ? (
            <div className="space-y-2 rounded-2xl border border-border bg-muted/30 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Add Sub-Agent</h4>
              <input
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setTargetId(e.target.value); }}
                placeholder="Enter User UUID or JALWA ID"
                className="w-full rounded-xl border border-border bg-background p-3 text-sm"
              />
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="Agent WhatsApp with Country Code"
                className="w-full rounded-xl border border-border bg-background p-3 text-sm"
              />
              <button
                disabled={createSubAgent.isPending || !targetId.trim() || whatsapp.length < 8}
                onClick={() => createSubAgent.mutate()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 p-3 font-black text-black disabled:opacity-50"
              >
                {createSubAgent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                Add Sub-Agent
              </button>
            </div>
          ) : (
            <p className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
              Maximum 5 Normal Agents reached. Remove an agent or contact Super Admin to adjust.
            </p>
          )}

          {/* Sub-agents list */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-muted-foreground">My Sub-Agents ({context.data?.children?.length || 0})</h4>
            {context.data?.children?.map((child) => (
              <div key={child.user_id} className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
                <div>
                  <p className="font-bold text-sm text-foreground">{child.username || "Agent"} ({child.user_code || "ID"})</p>
                  <p className="text-xs text-muted-foreground">
                    Coins Stock: <span className="text-amber-400 font-bold">{Number(child.available_coins || 0).toLocaleString()}</span>
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${child.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                  {child.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Settle with Admin */}
      {activeTab === "admin_settle" && (
        <div className="mt-5 space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
          <h4 className="text-sm font-bold">Exchange with Super Admin</h4>
          <p className="text-xs text-muted-foreground">
            Exchange your approved diamonds collected by sub-agents with Super Admin for Cash or fresh Coin stock in your country currency.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => window.location.assign("/coin-sellers#agent-buy-coins")} className="flex items-center justify-center gap-2 rounded-xl bg-amber-400 p-3 text-xs font-black text-black">
              <Coins className="h-4 w-4" /> Buy Coins from Admin
            </button>
            <button onClick={() => window.location.assign("/coin-sellers#agent-settle-diamonds")} className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background p-3 text-xs font-bold text-foreground">
              <ArrowRightLeft className="h-4 w-4" /> Redeem Diamonds
            </button>
          </div>
        </div>
      )}

      {/* Modal for Payout Slip Fullscreen Inspection */}
      {selectedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setSelectedSlip(null)}>
          <div className="relative max-w-lg w-full bg-background rounded-2xl p-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-bold mb-2">Payment Receipt Slip</h4>
            {selectedSlipUrl ? <img src={selectedSlipUrl} alt="Payment Receipt" className="w-full h-auto max-h-[70vh] object-contain rounded-xl border border-border" /> : <p className="py-10 text-center text-sm text-muted-foreground">Loading secure receipt…</p>}
            <button onClick={() => setSelectedSlip(null)} className="mt-3 w-full rounded-xl bg-muted py-2 text-xs font-bold">Close</button>
          </div>
        </div>
      )}
    </section>
  );
}
