import { useEffect, useState } from "react";
import { Check, Loader2, Save, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { p2pAction, PAYMENT_OPTIONS } from "@/lib/p2p";

type Agent = { user_id: string; currency_code: string; country: string; payment_methods: Record<string,string>; sell_rate: number; buy_rate: number; whatsapp_number: string | null; pending_whatsapp: string | null; is_active: boolean; is_banned: boolean };
type Settings = { base_fiat_amount: number; base_coin_amount: number; min_agent_coins: number; max_agent_coins: number; min_buy_margin_percent: number; max_buy_margin_percent: number };

export function AgentDashboard() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [methods, setMethods] = useState<Record<string,string>>({});
  const [sellRate, setSellRate] = useState("500");
  const [buyRate, setBuyRate] = useState("400");
  const [country, setCountry] = useState("Pakistan");
  const [currency, setCurrency] = useState("PKR");
  const [listingActive, setListingActive] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const result = await p2pAction<{agent: Agent | null; settings: Settings}>("GET_AGENT");
      setAgent(result.agent);
      setSettings(result.settings);
      if (result.agent) {
        setMethods(result.agent.payment_methods ?? {});
        setSellRate(String(result.agent.sell_rate));
        setBuyRate(String(result.agent.buy_rate));
        setCountry(result.agent.country);
        setCurrency(result.agent.currency_code);
        setListingActive(result.agent.is_active);
        setWhatsapp(result.agent.pending_whatsapp ?? result.agent.whatsapp_number ?? "");
      }
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    setBusy(true);
    try {
      const result = await p2pAction<{agent: Agent}>("SAVE_AGENT_PROFILE", { country, currency_code: currency, payment_methods: methods, sell_rate: Number(sellRate), buy_rate: Number(buyRate), is_active: listingActive });
      setAgent(result.agent); setListingActive(result.agent.is_active); toast.success(result.agent.is_active ? "Agent profile saved and listing active" : "Agent profile saved");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }
  async function requestWhatsApp() {
    setBusy(true);
    try { const result = await p2pAction<{agent: Agent}>("REQUEST_WHATSAPP", { whatsapp_number: whatsapp }); setAgent(result.agent); toast.success("WhatsApp update submitted for admin approval"); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="grid min-h-56 place-items-center"><Loader2 className="animate-spin"/></div>;
  if (agent?.is_banned) return <div className="m-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">Your P2P agent account has been restricted. Contact Jalwa support.</div>;

  return <section className="mx-auto w-full max-w-2xl space-y-4 p-3 pb-24 text-foreground sm:p-5">
    <div className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-zinc-900 to-amber-950/40 p-5"><div className="flex items-center gap-2 text-amber-300"><ShieldCheck size={18}/><span className="text-xs font-bold uppercase tracking-widest">Agent control centre</span></div><h1 className="mt-2 text-2xl font-black">Agent Dashboard</h1><p className="mt-1 text-sm text-zinc-400">Rates are validated by server-side admin limits. Your country is assigned by Admin and all P2P listings/orders are restricted to that country. Payment details are shared only with your escrow order participants.</p></div>
    {settings && <div className="rounded-2xl border border-border bg-card p-4 text-sm"><div className="font-bold">Admin price limits</div><p className="mt-1 text-muted-foreground">{settings.base_fiat_amount} fiat = {settings.base_coin_amount} base coins · sell rate {settings.min_agent_coins}–{settings.max_agent_coins} coins per {settings.base_fiat_amount} · buy margin {settings.min_buy_margin_percent}–{settings.max_buy_margin_percent}%</p></div>}
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-muted-foreground">Admin-assigned country<input value={country} readOnly disabled className="mt-1 w-full cursor-not-allowed rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground opacity-80"/></label><label className="text-xs font-semibold text-muted-foreground">Admin-assigned currency<input value={currency} readOnly disabled className="mt-1 w-full cursor-not-allowed rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground opacity-80"/></label></div>
      <div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-muted-foreground">Sell coins / base fiat<input type="number" value={sellRate} onChange={e=>setSellRate(e.target.value)} min={settings?.min_agent_coins} max={settings?.max_agent_coins} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"/></label><label className="text-xs font-semibold text-muted-foreground">Buy coins / base fiat<input type="number" value={buyRate} onChange={e=>setBuyRate(e.target.value)} min="1" className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"/></label></div>
      <div><h2 className="mb-2 text-sm font-bold">Payment methods</h2><div className="space-y-2">{PAYMENT_OPTIONS.map(option=><div key={option.key} className="rounded-xl border border-border p-3"><label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={!!methods[option.key]} onChange={e=>setMethods(prev=>{const next={...prev};if(!e.target.checked)delete next[option.key];else next[option.key]=prev[option.key]??"";return next;})}/>{option.label}</label>{!!methods[option.key] || Object.prototype.hasOwnProperty.call(methods,option.key) ? <input value={methods[option.key]??""} onChange={e=>setMethods(prev=>({...prev,[option.key]:e.target.value}))} placeholder={option.key==="usdt"?"Wallet address / network":"Account title and number"} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /> : null}</div>)}</div></div>
      <label className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm font-semibold"><span>Show my listing in marketplace</span><input type="checkbox" checked={listingActive} onChange={e=>setListingActive(e.target.checked)} /></label>
      <button disabled={busy} onClick={()=>void save()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 font-extrabold text-black disabled:opacity-50">{busy?<Loader2 className="animate-spin" size={16}/>:<Save size={16}/>}Save agent profile</button>
    </div>
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2 font-bold"><Smartphone size={17}/>WhatsApp number</div><p className="text-xs text-muted-foreground">Changes are not live until an admin approves them. Current: {agent?.whatsapp_number || "Not set"}{agent?.pending_whatsapp ? ` · Pending: ${agent.pending_whatsapp}` : ""}</p><input value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} maxLength={20} placeholder="+92 3xx xxxxxxx" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"/><button disabled={busy || !whatsapp.trim()} onClick={()=>void requestWhatsApp()} className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-bold disabled:opacity-50"><Check size={15}/>Request number update</button></div>
  </section>;
}
