import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, MessageCircle, RefreshCw, ShieldBan, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { p2pAction, type P2POrder } from "@/lib/p2p";
import { AdminPageHeader } from "@/components/admin/AdminShell";

type Agent = { user_id:string; country:string; currency_code:string; whatsapp_number:string|null; pending_whatsapp:string|null; is_banned:boolean; is_active:boolean };
type Settings = { id:string; base_fiat_amount:number; base_coin_amount:number; min_agent_coins:number; max_agent_coins:number; min_buy_margin_percent:number; max_buy_margin_percent:number };
type Overview = { orders:P2POrder[]; agents:Agent[]; settings:Settings };

export default function P2PResolution() {
  const [overview,setOverview]=useState<Overview|null>(null);
  const [busy,setBusy]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [settings,setSettings]=useState({base_fiat_amount:"50",base_coin_amount:"500",min_agent_coins:"500",max_agent_coins:"600",min_buy_margin_percent:"0",max_buy_margin_percent:"30"});
  async function load() {
    setLoading(true);
    try {
      const result=await p2pAction<Overview>("ADMIN_OVERVIEW");
      setOverview(result);
      if(result.settings) setSettings({
        base_fiat_amount:String(result.settings.base_fiat_amount),base_coin_amount:String(result.settings.base_coin_amount),
        min_agent_coins:String(result.settings.min_agent_coins),max_agent_coins:String(result.settings.max_agent_coins),
        min_buy_margin_percent:String(result.settings.min_buy_margin_percent),max_buy_margin_percent:String(result.settings.max_buy_margin_percent),
      });
    } catch(e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(()=>{void load();},[]);
  async function action(key:string, actionName:string, payload:Record<string,unknown>) {
    setBusy(key);
    try { await p2pAction(actionName as "ADMIN_COMPLETE",{...payload}); toast.success("P2P admin action completed"); await load(); }
    catch(e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }
  async function saveSettings() {
    setBusy("settings");
    try {
      await p2pAction("ADMIN_SAVE_SETTINGS",Object.fromEntries(Object.entries(settings).map(([key,value])=>[key,Number(value)])));
      toast.success("P2P pricing limits updated"); await load();
    } catch(e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }
  const field=(key:keyof typeof settings,label:string)=><label key={key} className="text-xs font-semibold text-muted-foreground">{label}<input type="number" value={settings[key]} onChange={e=>setSettings(s=>({...s,[key]:e.target.value}))} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"/></label>;
  return <div className="space-y-6">
    <AdminPageHeader title="P2P Resolution" subtitle="Resolve escrow disputes, approve agent contact updates, and control marketplace pricing." right={<button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"><RefreshCw size={14}/>Refresh</button>}/>
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 font-bold">Pricing & agent limits</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{field("base_fiat_amount","Base fiat amount")}{field("base_coin_amount","Base coin amount")}{field("min_agent_coins","Minimum sell rate")}{field("max_agent_coins","Maximum sell rate")}{field("min_buy_margin_percent","Minimum buy margin %")}{field("max_buy_margin_percent","Maximum buy margin %")}</div>
      <button disabled={busy==="settings"} onClick={()=>void saveSettings()} className="mt-4 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-extrabold text-black disabled:opacity-50">{busy==="settings"?"Saving…":"Save pricing limits"}</button>
    </section>
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 font-bold"><MessageCircle size={17}/>WhatsApp approval & agent controls</h2>
      {loading?<Loader2 className="animate-spin"/>:!overview?.agents.length?<p className="text-sm text-muted-foreground">No pending WhatsApp requests or restricted agents.</p>:<div className="space-y-3">{overview.agents.map(agent=><div key={agent.user_id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-bold">Agent {agent.user_id.slice(0,8).toUpperCase()}</div><div className="text-xs text-muted-foreground">{agent.country} · {agent.currency_code}</div><div className="mt-1 text-sm">Current: {agent.whatsapp_number||"Not set"} · Requested: {agent.pending_whatsapp||"None"}</div></div><span className={agent.is_banned?"text-xs font-bold text-red-400":"text-xs font-bold text-emerald-400"}>{agent.is_banned?"BANNED":"ACTIVE / INACTIVE"}</span></div><div className="mt-3 flex flex-wrap gap-2">{agent.pending_whatsapp&&<button disabled={!!busy} onClick={()=>void action(agent.user_id,"ADMIN_APPROVE_WHATSAPP",{agent_id:agent.user_id})} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white"><CheckCircle2 size={14}/>Approve WhatsApp</button>}<button disabled={!!busy} onClick={()=>void action(agent.user_id,"ADMIN_BAN_AGENT",{agent_id:agent.user_id,is_banned:!agent.is_banned})} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold">{agent.is_banned?<ShieldCheck size={14}/>:<ShieldBan size={14}/>} {agent.is_banned?"Unban agent":"Ban agent"}</button></div></div>)}</div>}
    </section>
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-1 flex items-center gap-2 font-bold"><AlertTriangle size={17} className="text-amber-400"/>Open escrow orders</h2><p className="mb-3 text-xs text-muted-foreground">Force-complete credits the buyer. Cancel returns locked coins to the agent. Review proof and payment details before deciding.</p>
      {loading?<Loader2 className="animate-spin"/>:!overview?.orders.length?<p className="text-sm text-muted-foreground">No open orders.</p>:<div className="space-y-3">{overview.orders.map(order=><div key={order.id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap justify-between gap-2"><div className="font-bold">Order {order.id.slice(0,8).toUpperCase()}</div><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase">{order.status}</span></div><p className="mt-1 text-sm">{Number(order.coin_amount).toLocaleString()} coins · {order.currency} {Number(order.fiat_amount).toLocaleString()}</p><p className="mt-1 break-all text-[11px] text-muted-foreground">Buyer {order.buyer_id} · Agent {order.agent_id}</p>{order.payment_proof_url&&<p className="mt-1 break-all text-xs text-muted-foreground">Proof path: {order.payment_proof_url}</p>}<div className="mt-3 flex flex-wrap gap-2">{["paid","appealed"].includes(order.status)&&<button disabled={!!busy} onClick={()=>void action(order.id,"ADMIN_COMPLETE",{order_id:order.id,reason:"Admin reviewed P2P escrow"})} className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white">Force complete</button>}{order.status!=="completed"&&order.status!=="cancelled"&&<button disabled={!!busy} onClick={()=>void action(order.id,"ADMIN_CANCEL",{order_id:order.id,reason:"Admin cancelled P2P escrow"})} className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-300">Cancel & refund agent</button>}</div></div>)}</div>}
    </section>
  </div>;
}
