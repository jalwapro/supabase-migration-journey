import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { MessageCircle, PackageCheck, ShieldAlert, ShoppingCart, Upload, XCircle } from "lucide-react";

const db = supabase as any;
const requestKey = () => crypto.randomUUID();
const input = "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-amber-400";
const primary = "inline-flex items-center justify-center rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-zinc-950 disabled:opacity-50";
const secondary = "inline-flex items-center justify-center rounded-xl border border-border px-3 py-2 text-xs font-bold disabled:opacity-50";

type RoleRow = { user_id: string; role: "admin" | "super_agent" | "sub_agent" | "user"; super_agent_id: string | null; display_name: string | null; active: boolean };
type Agent = { agent_id: string; country_code: string; currency_code: string; coins_per_bundle: number; payment_methods: string[]; payment_details: Record<string, unknown>; min_order_coins: number; max_order_coins: number; is_listed: boolean; profile?: RoleRow };
type Order = { id: string; buyer_id: string; agent_id: string; super_agent_id: string; amount_coins: number; fiat_currency: string; fiat_amount: number; payment_method: string; status: string; payment_reference: string | null; proof_path: string | null; created_at: string; signed_proof_url?: string | null };
type Appeal = { id: string; order_id: string; opened_by: string; reason: string; status: string; created_at: string; resolution_note: string | null };

export function P2PCoinMarket() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [countryFilter, setCountryFilter] = useState("all");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [amount, setAmount] = useState("500");
  const [method, setMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [appealReasons, setAppealReasons] = useState<Record<string, string>>({});
  const [selectedOrder, setSelectedOrder] = useState("");
  const [chatText, setChatText] = useState("");
  const [newSubAgentId, setNewSubAgentId] = useState("");
  const [newSubAgentName, setNewSubAgentName] = useState("");
  const [countryCode, setCountryCode] = useState("PK");
  const [currencyCode, setCurrencyCode] = useState("PKR");
  const [coinsPerBundle, setCoinsPerBundle] = useState("550");
  const [agentMethods, setAgentMethods] = useState("JazzCash,Easypaisa");
  const [paymentDetails, setPaymentDetails] = useState('{"JazzCash":"","Easypaisa":""}');
  const [minOrder, setMinOrder] = useState("500");
  const [maxOrder, setMaxOrder] = useState("100000");
  const [isListed, setIsListed] = useState(true);
  const [basePrice, setBasePrice] = useState("50");
  const [baseCoins, setBaseCoins] = useState("500");
  const [minAgentCoins, setMinAgentCoins] = useState("500");
  const [maxAgentCoins, setMaxAgentCoins] = useState("600");
  const [fiatRateCurrency, setFiatRateCurrency] = useState("PKR");
  const [pkrPerUnit, setPkrPerUnit] = useState("1");

  const role = useQuery({
    queryKey: ["p2p-market-role", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { error } = await db.rpc("p2p_ensure_profile");
      if (error) throw error;
      const { data, error: profileError } = await db.from("p2p_profiles").select("user_id,role,super_agent_id,display_name,active").eq("user_id", user!.id).single();
      if (profileError) throw profileError;
      return data as RoleRow;
    },
  });

  const currentRole = role.data?.role;

  const market = useQuery({
    queryKey: ["p2p-market-settings"],
    queryFn: async () => {
      const [{ data: settings, error }, { data: rates, error: rateError }] = await Promise.all([
        db.from("p2p_market_settings").select("*").eq("singleton", true).single(),
        db.from("p2p_coin_fiat_rates").select("currency_code,pkr_per_fiat_unit,active").eq("active", true).order("currency_code"),
      ]);
      if (error) throw error;
      if (rateError) throw rateError;
      return { settings, rates: rates ?? [] };
    },
  });

  const agents = useQuery({
    queryKey: ["p2p-market-agents"],
    queryFn: async () => {
      const { data, error } = await db.from("p2p_agent_settings").select("agent_id,country_code,currency_code,coins_per_bundle,payment_methods,payment_details,min_order_coins,max_order_coins,is_listed").eq("is_listed", true).order("country_code");
      if (error) throw error;
      const rows = (data ?? []) as Agent[];
      if (!rows.length) return rows;
      const { data: profiles, error: profileError } = await db.from("p2p_profiles").select("user_id,role,super_agent_id,display_name,active").in("user_id", rows.map(r => r.agent_id));
      if (profileError) throw profileError;
      const map = new Map((profiles ?? []).map((p: RoleRow) => [p.user_id, p]));
      return rows.filter(r => map.get(r.agent_id)?.role === "sub_agent" && map.get(r.agent_id)?.active).map(r => ({ ...r, profile: map.get(r.agent_id) }));
    },
    refetchInterval: 30_000,
  });

  const ownSettings = useQuery({
    queryKey: ["p2p-own-agent-settings", user?.id],
    enabled: !!user?.id && currentRole === "sub_agent",
    queryFn: async () => {
      const { data, error } = await db.from("p2p_agent_settings").select("*").eq("agent_id", user!.id).maybeSingle();
      if (error) throw error;
      if (data) {
        setCountryCode(data.country_code); setCurrencyCode(data.currency_code); setCoinsPerBundle(String(data.coins_per_bundle));
        setAgentMethods((data.payment_methods ?? []).join(",")); setPaymentDetails(JSON.stringify(data.payment_details ?? {}, null, 2));
        setMinOrder(String(data.min_order_coins)); setMaxOrder(String(data.max_order_coins)); setIsListed(data.is_listed);
      }
      return data as Agent | null;
    },
  });

  const orders = useQuery({
    queryKey: ["p2p-coin-orders", user?.id, currentRole],
    enabled: !!user?.id && !!role.data,
    queryFn: async () => {
      let q = db.from("p2p_coin_orders").select("*").order("created_at", { ascending: false }).limit(100);
      if (currentRole === "user") q = q.eq("buyer_id", user!.id);
      else if (currentRole === "sub_agent") q = q.eq("agent_id", user!.id);
      else if (currentRole === "super_agent") q = q.eq("super_agent_id", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as Order[];
      return Promise.all(rows.map(async row => {
        if (!row.proof_path || !["sub_agent", "super_agent", "admin"].includes(role.data!.role)) return { ...row, signed_proof_url: null };
        const { data: signed } = await supabase.storage.from("p2p_order_proofs").createSignedUrl(row.proof_path, 120);
        return { ...row, signed_proof_url: signed?.signedUrl ?? null };
      }));
    },
    refetchInterval: 20_000,
  });

  const appeals = useQuery({
    queryKey: ["p2p-coin-appeals"],
    enabled: currentRole === "admin",
    queryFn: async () => {
      const { data, error } = await db.from("p2p_order_appeals").select("*").eq("status", "open").order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Appeal[];
    },
  });

  const invalidate = async () => Promise.all([
    qc.invalidateQueries({ queryKey: ["p2p-market-agents"] }),
    qc.invalidateQueries({ queryKey: ["p2p-own-agent-settings"] }),
    qc.invalidateQueries({ queryKey: ["p2p-coin-orders"] }),
    qc.invalidateQueries({ queryKey: ["p2p-coin-appeals"] }),
    qc.invalidateQueries({ queryKey: ["p2p-wallet"] }),
    qc.invalidateQueries({ queryKey: ["p2p-wallet-summary"] }),
  ]);

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!selectedAgent) throw new Error("Choose an agent");
      const coins = Number(amount);
      if (!Number.isSafeInteger(coins) || coins <= 0) throw new Error("Enter a positive whole coin amount");
      const selected = agents.data?.find(a => a.agent_id === selectedAgent);
      if (!selected) throw new Error("This agent is no longer available");
      if (!method || !selected.payment_methods.includes(method)) throw new Error("Choose an agent-supported payment method");
      const { error } = await db.rpc("p2p_create_coin_order", { p_request_key: requestKey(), p_agent_id: selectedAgent, p_amount_coins: coins, p_payment_method: method });
      if (error) throw error;
    },
    onSuccess: async () => { toast.success("Order created. Pay the agent using the displayed details and submit proof."); await invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitPayment = useMutation({
    mutationFn: async (order: Order) => {
      if (!proof) throw new Error("Upload payment screenshot");
      if (!["image/png", "image/jpeg", "image/webp"].includes(proof.type) || proof.size > 5 * 1024 * 1024) throw new Error("Use PNG, JPG or WEBP up to 5 MB");
      if (paymentReference.trim().length < 3) throw new Error("Enter transaction/reference ID");
      const ext = proof.type === "image/png" ? "png" : proof.type === "image/webp" ? "webp" : "jpg";
      const path = order.id + "/" + requestKey() + "." + ext;
      const { error: uploadError } = await supabase.storage.from("p2p_order_proofs").upload(path, proof, { contentType: proof.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error } = await db.rpc("p2p_submit_coin_order_payment", { p_order_id: order.id, p_payment_reference: paymentReference.trim(), p_proof_path: path });
      if (error) { await supabase.storage.from("p2p_order_proofs").remove([path]); throw error; }
    },
    onSuccess: async () => { setProof(null); setPaymentReference(""); toast.success("Payment proof sent to agent"); await invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const agentSettings = useMutation({
    mutationFn: async () => {
      const rate = Number(coinsPerBundle), min = Number(minOrder), max = Number(maxOrder);
      if (!Number.isSafeInteger(rate) || !Number.isSafeInteger(min) || !Number.isSafeInteger(max)) throw new Error("Rate and order limits must be whole numbers");
      const methods = agentMethods.split(",").map(s => s.trim()).filter(Boolean);
      let details: Record<string, unknown>;
      try { details = JSON.parse(paymentDetails) as Record<string, unknown>; } catch { throw new Error("Payment details must be valid JSON"); }
      const { error } = await db.rpc("p2p_agent_set_market_profile", { p_country_code: countryCode.toUpperCase(), p_currency_code: currencyCode.toUpperCase(), p_coins_per_bundle: rate, p_payment_methods: methods, p_payment_details: details, p_min_order_coins: min, p_max_order_coins: max, p_is_listed: isListed });
      if (error) throw error;
    },
    onSuccess: async () => { toast.success("Agent market profile saved"); await invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const completeOrder = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.rpc("p2p_agent_complete_coin_order", { p_order_id: id }); if (error) throw error; },
    onSuccess: async () => { toast.success("Coins released to buyer"); await invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancelOrder = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.rpc("p2p_cancel_coin_order", { p_order_id: id }); if (error) throw error; },
    onSuccess: async () => { toast.success("Order cancelled; escrow returned to agent stock"); await invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const openAppeal = useMutation({
    mutationFn: async (order: Order) => { const reason = appealReasons[order.id]?.trim() ?? ""; const { error } = await db.rpc("p2p_open_coin_order_appeal", { p_order_id: order.id, p_reason: reason }); if (error) throw error; },
    onSuccess: async () => { toast.success("Appeal submitted to Admin"); await invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const resolveAppeal = useMutation({
    mutationFn: async ({ appealId, resolution }: { appealId: string; resolution: "resolved_to_buyer" | "resolved_to_agent" }) => {
      const { error } = await db.rpc("p2p_admin_resolve_coin_order_appeal", { p_appeal_id: appealId, p_resolution: resolution, p_note: resolution === "resolved_to_buyer" ? "Resolved in buyer's favor" : "Resolved in agent's favor" });
      if (error) throw error;
    },
    onSuccess: async () => { toast.success("Appeal resolved and escrow settled"); await invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const createSubAgent = useMutation({
    mutationFn: async () => {
      if (!newSubAgentId.trim()) throw new Error("Enter an existing JALWA user's Supabase UUID");
      const { error } = await db.rpc("p2p_super_agent_create_sub_agent", { p_user_id: newSubAgentId.trim(), p_display_name: newSubAgentName.trim() || null });
      if (error) throw error;
    },
    onSuccess: async () => { setNewSubAgentId(""); setNewSubAgentName(""); toast.success("Sub-Agent assigned to your agency"); await invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveMarket = useMutation({
    mutationFn: async () => {
      const { error } = await db.rpc("p2p_admin_set_market_settings", { p_base_price_pkr: Number(basePrice), p_base_coins: Number(baseCoins), p_min_agent_coins_per_bundle: Number(minAgentCoins), p_max_agent_coins_per_bundle: Number(maxAgentCoins), p_active: true });
      if (error) throw error;
    },
    onSuccess: async () => { toast.success("P2P base pricing saved"); await invalidate(); qc.invalidateQueries({ queryKey: ["p2p-market-settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveFiatRate = useMutation({
    mutationFn: async () => { const { error } = await db.rpc("p2p_admin_set_coin_fiat_rate", { p_currency_code: fiatRateCurrency.toUpperCase(), p_pkr_per_fiat_unit: Number(pkrPerUnit), p_active: true }); if (error) throw error; },
    onSuccess: async () => { toast.success("Currency conversion saved"); qc.invalidateQueries({ queryKey: ["p2p-market-settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const filteredAgents = useMemo(() => (agents.data ?? []).filter(a => countryFilter === "all" || a.country_code === countryFilter), [agents.data, countryFilter]);
  const selected = agents.data?.find(a => a.agent_id === selectedAgent);
  const quote = selected && Number.isFinite(Number(amount)) && Number(amount) > 0 && market.data
    ? (Number(amount) / Number(selected.coins_per_bundle) * Number(market.data.settings.base_price_pkr) / Number(market.data.rates.find((r: any) => r.currency_code === selected.currency_code)?.pkr_per_fiat_unit ?? 0))
    : null;

  async function sendMessage() {
    if (!user || !selectedOrder || !chatText.trim()) return;
    const { error } = await db.from("p2p_order_messages").insert({ order_id: selectedOrder, sender_id: user.id, message: chatText.trim() });
    if (error) return toast.error(error.message);
    setChatText("");
    await qc.invalidateQueries({ queryKey: ["p2p-order-messages", selectedOrder] });
  }

  const messages = useQuery({
    queryKey: ["p2p-order-messages", selectedOrder],
    enabled: !!selectedOrder,
    queryFn: async () => { const { data, error } = await db.from("p2p_order_messages").select("id,order_id,sender_id,message,created_at").eq("order_id", selectedOrder).order("created_at"); if (error) throw error; return data ?? []; },
    refetchInterval: 10_000,
  });

  if (role.isLoading) return <section className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">Loading P2P marketplace…</section>;
  if (role.isError) return <section className="rounded-2xl border border-border bg-card p-4 text-sm text-destructive">P2P marketplace is unavailable: {String(role.error)}</section>;

  return <div className="space-y-4">
    {currentRole === "user" && <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3"><ShoppingCart className="mt-1 h-5 w-5 text-amber-300"/><div><h2 className="font-black">Buy coins from a P2P Agent</h2><p className="mt-1 text-xs text-muted-foreground">Agent stock is locked in escrow. Submit payment proof; coins are released only when the agent confirms payment or Admin resolves an appeal.</p></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-bold text-muted-foreground">Country filter<select className={input} value={countryFilter} onChange={e=>setCountryFilter(e.target.value)}><option value="all">All countries</option>{[...new Set((agents.data??[]).map(a=>a.country_code))].map(c=><option key={c}>{c}</option>)}</select></label>
        <label className="text-xs font-bold text-muted-foreground">Agent<select className={input} value={selectedAgent} onChange={e=>{setSelectedAgent(e.target.value);setMethod("");}}><option value="">Choose agent</option>{filteredAgents.map(a=><option key={a.agent_id} value={a.agent_id}>{a.profile?.display_name || a.agent_id.slice(0,8)} · {a.country_code} · {a.coins_per_bundle} coins / {market.data?.settings.base_price_pkr} PKR</option>)}</select></label>
        <label className="text-xs font-bold text-muted-foreground">Coin amount<input className={input} type="number" min={selected?.min_order_coins ?? 1} max={selected?.max_order_coins ?? 100000} step="1" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
      </div>
      {selected && <div className="mt-3 rounded-xl border border-border bg-background/50 p-3 text-sm">
        <p className="font-bold">Payment options</p><div className="mt-2 flex flex-wrap gap-2">{selected.payment_methods.map(m=><button key={m} onClick={()=>setMethod(m)} className={method===m?"rounded-full bg-amber-400 px-3 py-1.5 text-xs font-black text-black":"rounded-full border border-border px-3 py-1.5 text-xs"}>{m}</button>)}</div>
        <p className="mt-3 text-xs text-muted-foreground">Pay amount: <strong className="text-foreground">{selected.currency_code} {quote === null || !Number.isFinite(quote) ? "—" : quote.toFixed(2)}</strong></p>
        {method && <pre className="mt-2 overflow-auto rounded-lg bg-background p-3 text-xs">{JSON.stringify(selected.payment_details?.[method] ?? selected.payment_details, null, 2)}</pre>}
        <button className={primary+" mt-3"} disabled={createOrder.isPending || !method} onClick={()=>createOrder.mutate()}>Lock agent stock & create order</button>
      </div>}
    </section>}

    {currentRole === "sub_agent" && <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="font-black">Agent marketplace profile</h2><p className="mt-1 text-xs text-muted-foreground">Set your country, accepted payment methods, payout details and coin price. Admin controls the allowed price range.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-bold text-muted-foreground">Admin-assigned country<input className={input+" opacity-70"} maxLength={2} value={ownSettings.data?.country_code ?? "Not assigned"} readOnly/></label>
        <label className="text-xs font-bold text-muted-foreground">Admin-assigned currency<input className={input+" opacity-70"} maxLength={3} value={ownSettings.data?.currency_code ?? "Not assigned"} readOnly/></label>
        <label className="text-xs font-bold text-muted-foreground">Coins per 50 PKR bundle<input className={input} type="number" min={market.data?.settings.min_agent_coins_per_bundle ?? 500} max={market.data?.settings.max_agent_coins_per_bundle ?? 600} value={coinsPerBundle} onChange={e=>setCoinsPerBundle(e.target.value)}/></label>
        <label className="text-xs font-bold text-muted-foreground">Minimum order coins<input className={input} type="number" min="1" value={minOrder} onChange={e=>setMinOrder(e.target.value)}/></label>
        <label className="text-xs font-bold text-muted-foreground">Maximum order coins<input className={input} type="number" min={minOrder} value={maxOrder} onChange={e=>setMaxOrder(e.target.value)}/></label>
        <label className="text-xs font-bold text-muted-foreground">Payment methods (comma-separated)<input className={input} value={agentMethods} onChange={e=>setAgentMethods(e.target.value)}/></label>
      </div>
      <label className="mt-3 block text-xs font-bold text-muted-foreground">Payment details JSON<textarea className={input+" min-h-24 font-mono"} value={paymentDetails} onChange={e=>setPaymentDetails(e.target.value)}/></label>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={isListed} onChange={e=>setIsListed(e.target.checked)}/> List my agent profile in marketplace</label>
      <button className={primary+" mt-3"} disabled={agentSettings.isPending} onClick={()=>agentSettings.mutate()}>Save Agent Profile</button>
    </section>}

    {currentRole === "super_agent" && <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="font-black">Manage Sub-Agents</h2><p className="mt-1 text-xs text-muted-foreground">You can assign up to five existing JALWA users to your agency. Ask the user for their Supabase UUID.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-muted-foreground">User UUID<input className={input} value={newSubAgentId} onChange={e=>setNewSubAgentId(e.target.value)}/></label><label className="text-xs font-bold text-muted-foreground">Display name<input className={input} value={newSubAgentName} onChange={e=>setNewSubAgentName(e.target.value)}/></label></div>
      <button className={primary+" mt-3"} disabled={createSubAgent.isPending} onClick={()=>createSubAgent.mutate()}>Add Sub-Agent</button>
    </section>}

    {currentRole === "admin" && <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="font-black">Admin P2P pricing controls</h2><p className="mt-1 text-xs text-muted-foreground">Default is PKR 50 per bundle. Agents can choose 500–600 coins per bundle within your limits.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <label className="text-xs font-bold text-muted-foreground">Base price PKR<input className={input} type="number" min="0.01" value={basePrice} onChange={e=>setBasePrice(e.target.value)}/></label>
        <label className="text-xs font-bold text-muted-foreground">Base coins<input className={input} type="number" min="1" value={baseCoins} onChange={e=>setBaseCoins(e.target.value)}/></label>
        <label className="text-xs font-bold text-muted-foreground">Min agent coins<input className={input} type="number" min="1" value={minAgentCoins} onChange={e=>setMinAgentCoins(e.target.value)}/></label>
        <label className="text-xs font-bold text-muted-foreground">Max agent coins<input className={input} type="number" min={minAgentCoins} value={maxAgentCoins} onChange={e=>setMaxAgentCoins(e.target.value)}/></label>
      </div><button className={primary+" mt-3"} disabled={saveMarket.isPending} onClick={()=>saveMarket.mutate()}>Save market pricing</button>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="text-xs font-bold text-muted-foreground">Fiat currency<input className={input} maxLength={3} value={fiatRateCurrency} onChange={e=>setFiatRateCurrency(e.target.value)}/></label><label className="text-xs font-bold text-muted-foreground">PKR per 1 currency unit<input className={input} type="number" min="0.00000001" step="any" value={pkrPerUnit} onChange={e=>setPkrPerUnit(e.target.value)}/></label><button className={primary+" self-end"} disabled={saveFiatRate.isPending} onClick={()=>saveFiatRate.mutate()}>Save currency rate</button></div>
      {appeals.data?.map(a=><article key={a.id} className="mt-3 rounded-xl border border-red-400/30 p-3"><p className="flex items-center gap-2 font-bold"><ShieldAlert className="h-4 w-4 text-red-400"/>Open appeal · Order {a.order_id}</p><p className="mt-2 text-sm">{a.reason}</p><div className="mt-3 flex flex-wrap gap-2"><button className={secondary} disabled={resolveAppeal.isPending} onClick={()=>resolveAppeal.mutate({appealId:a.id,resolution:"resolved_to_buyer"})}>Resolve for buyer</button><button className={secondary} disabled={resolveAppeal.isPending} onClick={()=>resolveAppeal.mutate({appealId:a.id,resolution:"resolved_to_agent"})}>Resolve for agent</button></div></article>)}
    </section>}

    {currentRole && <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="font-black">P2P coin orders</h2><p className="mt-1 text-xs text-muted-foreground">Payment proof, agent confirmation, order chat and appeals are recorded per order.</p>
      {!orders.data?.length && <p className="mt-3 text-sm text-muted-foreground">No coin orders yet.</p>}
      <div className="mt-3 space-y-3">{(orders.data??[]).map(o=><article key={o.id} className="rounded-xl border border-border p-3">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-black">{Number(o.amount_coins).toLocaleString()} coins · {o.fiat_currency} {Number(o.fiat_amount).toFixed(2)}</p><p className="mt-1 break-all text-[10px] text-muted-foreground">Order {o.id} · {new Date(o.created_at).toLocaleString()}</p></div><span className="rounded-full border border-border px-2 py-1 text-[10px] font-bold uppercase">{o.status.replaceAll("_"," ")}</span></div>
        <p className="mt-1 text-xs text-muted-foreground">Buyer {o.buyer_id.slice(0,8)} · Agent {o.agent_id.slice(0,8)} · {o.payment_method}</p>{currentRole==="user" && <pre className="mt-2 overflow-auto rounded-lg bg-background p-3 text-xs">Payment details: {JSON.stringify(agents.data?.find(a=>a.agent_id===o.agent_id)?.payment_details?.[o.payment_method] ?? agents.data?.find(a=>a.agent_id===o.agent_id)?.payment_details ?? {}, null, 2)}</pre>}
        {o.proof_path && <div className="mt-2 text-sm">{o.signed_proof_url ? <a href={o.signed_proof_url} target="_blank" rel="noreferrer" className="font-bold text-amber-300 underline">View payment proof</a> : <span className="text-muted-foreground">Payment proof submitted</span>}<p className="text-xs text-muted-foreground">Reference: {o.payment_reference}</p></div>}
        {currentRole==="user" && o.status==="pending_payment" && <div className="mt-3 space-y-2"><label className="block text-xs font-bold">Transaction/reference<input className={input} value={paymentReference} onChange={e=>setPaymentReference(e.target.value)}/></label><label className="block text-xs font-bold">Payment screenshot<input className="mt-1 block w-full text-xs" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setProof(e.target.files?.[0]??null)}/></label><button className={primary} disabled={submitPayment.isPending} onClick={()=>submitPayment.mutate(o)}><Upload className="mr-2 h-4 w-4"/>Submit payment proof</button><button className={secondary+" ml-2"} disabled={cancelOrder.isPending} onClick={()=>cancelOrder.mutate(o.id)}><XCircle className="mr-1 h-3 w-3"/>Cancel unpaid order</button></div>}
        {currentRole==="sub_agent" && o.status==="payment_submitted" && <button className={primary+" mt-3"} disabled={completeOrder.isPending} onClick={()=>completeOrder.mutate(o.id)}><PackageCheck className="mr-2 h-4 w-4"/>Confirm payment & release coins</button>}
        {currentRole==="user" && o.status==="payment_submitted" && <div className="mt-3 space-y-2"><textarea className={input} placeholder="Explain the payment issue to Admin" value={appealReasons[o.id]??""} onChange={e=>setAppealReasons(p=>({...p,[o.id]:e.target.value}))}/><button className={secondary} disabled={openAppeal.isPending} onClick={()=>openAppeal.mutate(o)}>Open appeal</button></div>}
        {["pending_payment","payment_submitted","appealed"].includes(o.status) && <div className="mt-3 rounded-xl border border-border bg-background/50 p-3"><p className="mb-2 flex items-center gap-2 text-xs font-bold"><MessageCircle className="h-4 w-4"/>Order chat</p>{selectedOrder===o.id && <div className="mb-2 max-h-32 space-y-1 overflow-y-auto">{(messages.data??[]).map((m:any)=><p key={m.id} className="text-xs"><strong>{m.sender_id===user?.id?"You":m.sender_id.slice(0,8)}:</strong> {m.message}</p>)}</div>}<div className="flex gap-2"><input className={input+" mt-0"} value={selectedOrder===o.id?chatText:""} placeholder="Message buyer/agent" onFocus={()=>setSelectedOrder(o.id)} onChange={e=>{setSelectedOrder(o.id);setChatText(e.target.value)}}/><button className={secondary} onClick={()=>{setSelectedOrder(o.id);void sendMessage();}} disabled={!chatText.trim()||selectedOrder!==o.id}>Send</button></div></div>}
      </article>)}</div>
    </section>}
  </div>;
}
