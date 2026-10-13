import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, FileImage, Loader2, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { uploadPrivateToUserFolder } from "@/lib/uploads";

type PayoutAgent = { user_id: string; username: string | null; user_code: string | null; country: string | null; currency_code: string | null; rate_pkr_per_1000: number };
type PayoutRequest = { id: string; user_id: string; normal_agent_id: string; super_agent_id: string | null; source_type: string; diamonds: number; payout_amount: number; currency: string; payout_method: string; payout_account_number: string; payout_account_name: string; payout_slip_url: string | null; status: string; created_at: string };
const fmt = (value: unknown) => Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const sourceLabel = (value: string) => value === "red_diamonds" ? "Red Diamonds" : "Wallet Diamonds";

export function DiamondPayoutFlow() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [agentId, setAgentId] = useState("");
  const [source, setSource] = useState("profile_diamonds");
  const [diamonds, setDiamonds] = useState("50000");
  const [method, setMethod] = useState("jazzcash");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [busy, setBusy] = useState("");
  const [proofs, setProofs] = useState<Record<string, File | undefined>>({});

  const agentsQuery = useQuery({
    queryKey: ["diamond-payout-agents"],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("diamond_payout_agents_for_user");
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as PayoutAgent[];
    },
    staleTime: 30_000,
  });
  const requestsQuery = useQuery({
    queryKey: ["diamond-payout-requests", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("diamond_payout_requests")
        .select("id,user_id,normal_agent_id,super_agent_id,source_type,diamonds,payout_amount,currency,payout_method,payout_account_number,payout_account_name,payout_slip_url,status,created_at")
        .or(`user_id.eq.${user!.id},normal_agent_id.eq.${user!.id}`)
        .order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (data ?? []) as PayoutRequest[];
    },
    refetchInterval: 10_000,
  });

  useEffect(() => {
    if (!agentId && agentsQuery.data?.length) setAgentId(agentsQuery.data[0].user_id);
  }, [agentId, agentsQuery.data]);

  const selectedAgent = useMemo(() => agentsQuery.data?.find(agent => agent.user_id === agentId), [agentsQuery.data, agentId]);
  const myRequests = (requestsQuery.data ?? []).filter(request => request.user_id === user?.id);
  const incomingRequests = (requestsQuery.data ?? []).filter(request => request.normal_agent_id === user?.id && request.user_id !== user?.id);

  async function createRequest() {
    if (!user) return;
    const amount = Number(diamonds);
    if (!Number.isSafeInteger(amount) || amount < 100 || amount > 1_000_000_000) return toast.error("Enter a whole diamond amount between 100 and 1,000,000,000.");
    if (!agentId || !accountName.trim() || accountNumber.trim().length < 5) return toast.error("Select an agent and enter valid payout account details.");
    setBusy("create");
    try {
      const { error } = await (supabase as any).rpc("create_diamond_payout_request", {
        _agent_id: agentId, _source_type: source, _diamonds: amount, _payout_method: method,
        _payout_account_number: accountNumber.trim(), _payout_account_name: accountName.trim(),
      });
      if (error) throw error;
      toast.success("Payout request created. Your diamonds are held until the request is completed or rejected.");
      setAccountName(""); setAccountNumber("");
      await Promise.all([qc.invalidateQueries({ queryKey: ["diamond-payout-requests", user.id] }), qc.invalidateQueries({ queryKey: ["profile"] }), qc.invalidateQueries({ queryKey: ["host_red_diamonds"] })]);
    } catch (error) { toast.error((error as Error).message || "Could not create payout request"); }
    finally { setBusy(""); }
  }

  async function submitSlip(request: PayoutRequest) {
    if (!user) return;
    const file = proofs[request.id];
    if (!file) return toast.error("Attach the payment screenshot first.");
    if (!file.type.startsWith("image/")) return toast.error("Upload a JPG, PNG or WebP payment screenshot.");
    setBusy(request.id);
    try {
      const uploaded = await uploadPrivateToUserFolder("payout-slips", file, user.id);
      const { error } = await (supabase as any).from("diamond_payout_requests").update({
        payout_slip_url: uploaded.url, status: "slip_submitted", agent_paid_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", request.id).eq("normal_agent_id", user.id).eq("status", "pending_agent_payment");
      if (error) throw error;
      toast.success("Payment receipt submitted to your parent Super Agent for verification.");
      setProofs(prev => { const next = { ...prev }; delete next[request.id]; return next; });
      await qc.invalidateQueries({ queryKey: ["diamond-payout-requests", user.id] });
    } catch (error) { toast.error((error as Error).message || "Could not submit payment receipt"); }
    finally { setBusy(""); }
  }

  if (!user) return null;
  return <div className="space-y-4">
    <section className="rounded-2xl border border-amber-400/25 bg-card p-4">
      <div className="flex items-center gap-2"><Banknote className="h-5 w-5 text-amber-400"/><h2 className="text-lg font-black">Verified Diamond Payout</h2></div>
      <p className="mt-1 text-xs text-muted-foreground">Choose a normal Coin Agent under an active Super Agent. Your diamonds are held securely while the agent pays you; a receipt is reviewed before the agent receives diamond inventory. Rejected requests refund your held diamonds.</p>
      <div className="mt-4 space-y-3">
        <label className="block text-xs font-semibold">Diamond source<select value={source} onChange={e=>setSource(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm"><option value="profile_diamonds">Wallet Diamonds</option><option value="red_diamonds">Red Diamonds</option></select></label>
        <label className="block text-xs font-semibold">Diamonds amount<input type="number" min="100" step="1" value={diamonds} onChange={e=>setDiamonds(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm"/></label>
        <label className="block text-xs font-semibold">Normal Coin Agent<select value={agentId} onChange={e=>setAgentId(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm"><option value="">Select agent</option>{(agentsQuery.data??[]).map(agent=><option key={agent.user_id} value={agent.user_id}>{agent.username || agent.user_code || agent.user_id.slice(0,8)} · {agent.country || "—"} · {agent.currency_code || "PKR"} {fmt(agent.rate_pkr_per_1000)}/1,000</option>)}</select></label>
        {selectedAgent && <p className="rounded-xl bg-background p-3 text-sm">Estimated payout: <b>{selectedAgent.currency_code || "PKR"} {fmt(Number(diamonds) * Number(selectedAgent.rate_pkr_per_1000) / 1000)}</b></p>}
        <div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold">Payout method<select value={method} onChange={e=>setMethod(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm"><option value="jazzcash">JazzCash</option><option value="easypaisa">Easypaisa</option><option value="bank">Bank transfer</option><option value="other">Other</option></select></label><label className="text-xs font-semibold">Account title<input value={accountName} onChange={e=>setAccountName(e.target.value)} placeholder="Account holder" className="mt-1 w-full min-w-0 rounded-xl border border-border bg-background p-3 text-sm"/></label></div>
        <label className="block text-xs font-semibold">Mobile / bank account number<input value={accountNumber} onChange={e=>setAccountNumber(e.target.value)} placeholder="Payout account number" className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm"/></label>
        <button disabled={!!busy || agentsQuery.isLoading || !agentId} onClick={()=>void createRequest()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 p-3 font-black text-black disabled:opacity-50">{busy==="create"?<Loader2 className="h-4 w-4 animate-spin"/>:<ShieldCheck className="h-4 w-4"/>}Request diamond payout</button>
        {agentsQuery.isError && <p className="text-xs text-red-400">Could not load agents. Please refresh and try again.</p>}
        {!agentsQuery.isLoading && !agentsQuery.data?.length && <p className="text-xs text-muted-foreground">No active normal agents under a Super Agent are available yet.</p>}
      </div>
    </section>

    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2"><h3 className="font-bold">My payout requests</h3><button onClick={()=>void qc.invalidateQueries({queryKey:["diamond-payout-requests",user.id]})} className="rounded-lg border border-border p-2" aria-label="Refresh payout requests"><RefreshCw className="h-4 w-4"/></button></div>
      <div className="mt-3 space-y-2">{requestsQuery.isLoading?<Loader2 className="mx-auto h-5 w-5 animate-spin"/>:myRequests.length?myRequests.map(request=><div key={request.id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><b>{fmt(request.diamonds)} {sourceLabel(request.source_type)}</b><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase">{request.status.replaceAll("_"," ")}</span></div><p className="mt-1 text-xs text-muted-foreground">{request.currency} {fmt(request.payout_amount)} · {request.payout_method} · {new Date(request.created_at).toLocaleString()}</p>{request.status==="pending_agent_payment"&&<button disabled={!!busy} onClick={async()=>{setBusy(request.id);try{const {error}=await (supabase as any).rpc("cancel_diamond_payout_request",{_request_id:request.id});if(error)throw error;toast.success("Request cancelled and diamonds returned.");await Promise.all([qc.invalidateQueries({queryKey:["diamond-payout-requests",user.id]}),qc.invalidateQueries({queryKey:["profile"]}),qc.invalidateQueries({queryKey:["host_red_diamonds"]})]);}catch(error){toast.error((error as Error).message||"Could not cancel payout request");}finally{setBusy("");}}} className="mt-3 rounded-lg border border-border px-3 py-2 text-xs font-bold disabled:opacity-50">{busy===request.id?"Cancelling…":"Cancel request & return diamonds"}</button>}</div>):<p className="text-xs text-muted-foreground">No payout requests yet.</p>}</div>
    </section>

    {incomingRequests.length > 0 && <section className="rounded-2xl border border-emerald-400/25 bg-card p-4">
      <div className="flex items-center gap-2"><Upload className="h-5 w-5 text-emerald-400"/><h3 className="font-black">Incoming diamond payout requests</h3></div>
      <p className="mt-1 text-xs text-muted-foreground">Pay the user through the selected method first, then attach the payment receipt. Your parent Super Agent must approve the receipt before diamonds are added to your inventory.</p>
      <div className="mt-3 space-y-3">{incomingRequests.filter(request=>request.status==="pending_agent_payment").map(request=><div key={request.id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><b>{fmt(request.diamonds)} {sourceLabel(request.source_type)}</b><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase">{request.status.replaceAll("_"," ")}</span></div><p className="mt-1 text-xs text-muted-foreground">Pay {request.currency} {fmt(request.payout_amount)} via {request.payout_method} to {request.payout_account_name} · {request.payout_account_number}</p><label className="mt-3 block text-xs font-semibold">Payment receipt screenshot<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setProofs(prev=>({...prev,[request.id]:e.target.files?.[0]}))} className="mt-1 block w-full text-xs"/></label><button disabled={!!busy || !proofs[request.id]} onClick={()=>void submitSlip(request)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 p-3 text-sm font-bold text-white disabled:opacity-50">{busy===request.id?<Loader2 className="h-4 w-4 animate-spin"/>:<FileImage className="h-4 w-4"/>}Submit payment receipt</button></div>)}</div>
    </section>}
  </div>;
}
