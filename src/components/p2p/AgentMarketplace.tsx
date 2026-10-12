import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Globe2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { p2pAction, type AgentListing } from "@/lib/p2p";
import { useAuth } from "@/hooks/useAuth";

const COUNTRIES = ["Global", "Pakistan", "India", "Bangladesh", "Saudi Arabia", "United Arab Emirates", "United Kingdom", "United States", "Indonesia", "Malaysia", "Philippines", "Nigeria", "Turkey"];

export function AgentMarketplace() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [agents, setAgents] = useState<AgentListing[]>([]);
  const [country, setCountry] = useState("Pakistan");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load(nextCountry = country) {
    setLoading(true);
    try {
      const result = await p2pAction<AgentListing[]>("MARKETPLACE", { country: nextCountry === "Global" ? null : nextCountry });
      setAgents(Array.isArray(result) ? result : []);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (profile?.country) setCountry(profile.country); }, [profile?.country]);
  useEffect(() => { void load(country); }, [country]);

  async function createOrder(agent: AgentListing) {
    setBusy(agent.user_id);
    try {
      const result = await p2pAction<{ order: { id: string } }>("CREATE_ORDER", { agent_id: agent.user_id, coin_amount: agent.sell_rate });
      toast.success("Escrow order created. Agent coins are locked securely.");
      await navigate({ to: "/p2p/order/$orderId", params: { orderId: result.order.id } });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }

  return <section className="mx-auto w-full max-w-3xl space-y-4 p-3 pb-24 text-foreground sm:p-5">
    <div className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950/40 p-5 shadow-xl">
      <div className="flex items-center gap-2 text-amber-300"><ShieldCheck size={18}/><span className="text-xs font-bold uppercase tracking-[.2em]">Protected coin trading</span></div>
      <h1 className="mt-2 text-2xl font-black">P2P Coin Market</h1>
      <p className="mt-1 max-w-lg text-sm text-zinc-400">Coins are locked in escrow until the agent confirms payment. Never mark paid before sending the money.</p>
      <label className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
        <Globe2 size={17} className="text-amber-300"/>
        <span className="text-xs text-zinc-400">Country</span>
        <select value={country} onChange={e => setCountry(e.target.value)} className="ml-auto min-w-0 flex-1 bg-transparent text-right text-sm outline-none">
          {COUNTRIES.map(c => <option key={c} value={c} className="bg-zinc-900">{c}</option>)}
        </select>
      </label>
    </div>
    {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-amber-300"/></div> :
      agents.length === 0 ? <div className="rounded-2xl border border-border bg-card p-8 text-center"><Globe2 className="mx-auto mb-3 text-muted-foreground"/><p className="font-semibold">No active agents found</p><p className="mt-1 text-sm text-muted-foreground">Try Global or another country.</p><button onClick={() => void load()} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm"><RefreshCw size={14}/>Refresh</button></div> :
      <div className="space-y-3">{agents.map(agent => <article key={agent.user_id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="font-bold">Agent {agent.user_id.slice(0, 6).toUpperCase()}</div><div className="mt-1 text-xs text-muted-foreground">{agent.country} · {agent.currency_code}</div></div><span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400">ESCROW READY</span></div>
        <div className="mt-3 flex flex-wrap gap-1.5">{agent.payment_methods.map(method => <span key={method} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold capitalize">{method.replaceAll("_"," ")}</span>)}</div>
        <div className="mt-4 flex items-end justify-between gap-3"><div><div className="text-xs text-muted-foreground">Rate per {agent.sell_rate} coins</div><div className="text-xl font-black text-emerald-400">{agent.currency_code} {Number(agent.base_fiat_amount).toFixed(0)}</div><div className="text-xs text-muted-foreground">Default order: {agent.sell_rate} coins</div></div><button disabled={busy === agent.user_id} onClick={() => void createOrder(agent)} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-extrabold text-black disabled:opacity-50">{busy === agent.user_id ? <Loader2 size={15} className="animate-spin"/> : <>Buy coins <ArrowRight size={15}/></>}</button></div>
      </article>)}</div>}
  </section>;
}
