import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ArrowLeftRight, Coins, Gem, Loader2, RefreshCw, ShieldCheck, Upload, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/p2p-agency")({ component: P2PAgencyPage });

type P2PProfile = { user_id: string; role: "admin" | "super_agent" | "sub_agent" | "user"; super_agent_id: string | null; display_name: string | null; active: boolean };
type Wallet = { coin_available: number; diamond_available: number; diamond_locked: number };
type Rate = { currency_code: string; diamonds_per_fiat_unit: number; active: boolean };
type Withdrawal = { id: string; user_id: string; sub_agent_id: string; super_agent_id: string; amount: number; fiat_currency: string; fiat_amount: number; status: string; created_at: string; payout_screenshot_path: string | null; payout_reference: string | null; payout_method: string | null; payout_account_name: string | null; payout_account_number: string | null; rejection_reason: string | null };

const db = supabase as any;
const newKey = () => crypto.randomUUID();
const errorText = (e: unknown) => e instanceof Error ? e.message : String((e as any)?.message ?? e ?? "Request failed");

function P2PAgencyPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("1000");
  const [subAgentId, setSubAgentId] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("JazzCash");
  const [payoutAccountName, setPayoutAccountName] = useState("");
  const [payoutAccountNumber, setPayoutAccountNumber] = useState("");
  const [roleUserId, setRoleUserId] = useState("");
  const [role, setRole] = useState<"user" | "super_agent" | "sub_agent">("sub_agent");
  const [parentId, setParentId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [marketCountry, setMarketCountry] = useState("all");
  const [listingCountryCode, setListingCountryCode] = useState("PK");
  const [listingCurrencyCode, setListingCurrencyCode] = useState("PKR");
  const [listingWhatsApp, setListingWhatsApp] = useState("");
  const [listingPrice, setListingPrice] = useState("100");
  const [listingActive, setListingActive] = useState(false);
  const [childUserId, setChildUserId] = useState("");
  const [childDisplayName, setChildDisplayName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [currency, setCurrency] = useState("PKR");
  const [rate, setRate] = useState("100");
  const [grantUserId, setGrantUserId] = useState("");
  const [grantAmount, setGrantAmount] = useState("1000");
  const [grantAsset, setGrantAsset] = useState<"coin" | "diamond">("coin");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("1000");
  const [proofRef, setProofRef] = useState<Record<string, string>>({});
  const [proofFiles, setProofFiles] = useState<Record<string, File | null>>({});

  const profile = useQuery({
    queryKey: ["p2p-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { error: initError } = await db.rpc("p2p_ensure_profile");
      if (initError) throw initError;
      const { data, error } = await db.from("p2p_profiles").select("user_id,role,super_agent_id,display_name,active").eq("user_id", user!.id).single();
      if (error) throw error;
      return data as P2PProfile;
    },
  });
  const userSearchResults = useQuery({
    queryKey: ["p2p-user-search", userSearch],
    enabled: !!user?.id && (profile.data?.role === "admin" || profile.data?.role === "super_agent" || profile.data?.role === "sub_agent") && userSearch.trim().length >= 2,
    queryFn: async () => {
      const term = userSearch.trim().replace(/[,%()]/g, "");
      const query = db.from("profiles").select("id,username,user_code").limit(8);
      const result = /^[0-9a-f-]{36}$/i.test(term)
        ? await query.eq("id", term)
        : await query.or(`username.ilike.%${term}%,user_code.eq.${term}`);
      if (result.error) throw result.error;
      return (result.data ?? []) as Array<{ id: string; username: string | null; user_code: string | null }>;
    },
  });
  const recipientSearchResults = useQuery({
    queryKey: ["p2p-recipient-search", recipientSearch],
    enabled: !!user?.id && !!profile.data && recipientSearch.trim().length >= 2,
    queryFn: async () => {
      const term = recipientSearch.trim().replace(/[,%()]/g, "");
      const query = db.from("profiles").select("id,username,user_code").limit(8);
      const result = /^[0-9a-f-]{36}$/i.test(term)
        ? await query.eq("id", term)
        : await query.or(`username.ilike.%${term}%,user_code.eq.${term}`);
      if (result.error) throw result.error;
      return (result.data ?? []) as Array<{ id: string; username: string | null; user_code: string | null }>;
    },
  });
  const marketplace = useQuery({
    queryKey: ["p2p-agent-marketplace"],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await db.from("p2p_agent_listings")
        .select("user_id,country_code,currency_code,whatsapp_number,sell_price_per_1000")
        .eq("listed", true)
        .order("country_code");
      if (error) throw error;
      return (data ?? []) as Array<{ user_id: string; country_code: string; currency_code: string; whatsapp_number: string; sell_price_per_1000: number }>;
    },
    refetchInterval: 60_000,
  });
  const agentListing = useQuery({
    queryKey: ["p2p-agent-listing", user?.id],
    enabled: !!user?.id && profile.data?.role === "sub_agent",
    queryFn: async () => {
      const { data, error } = await db.from("p2p_agent_listings")
        .select("user_id,country_code,currency_code,whatsapp_number,sell_price_per_1000,listed")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as { user_id: string; country_code: string; currency_code: string; whatsapp_number: string; sell_price_per_1000: number; listed: boolean } | null;
    },
  });
  useEffect(() => {
    if (!agentListing.data) return;
    setListingCountryCode(agentListing.data.country_code);
    setListingCurrencyCode(agentListing.data.currency_code);
    setListingWhatsApp(agentListing.data.whatsapp_number);
    setListingPrice(String(agentListing.data.sell_price_per_1000));
    setListingActive(agentListing.data.listed);
  }, [agentListing.data]);
  const mySubAgents = useQuery({
    queryKey: ["p2p-my-subagents", user?.id],
    enabled: !!user?.id && profile.data?.role === "super_agent",
    queryFn: async () => {
      const { data, error } = await db.from("p2p_profiles")
        .select("user_id,display_name,active,created_at")
        .eq("super_agent_id", user!.id)
        .eq("role", "sub_agent")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{ user_id: string; display_name: string | null; active: boolean; created_at: string }>;
    },
  });
  const wallet = useQuery({
    queryKey: ["p2p-wallet", user?.id],
    enabled: !!user?.id && !!profile.data,
    queryFn: async () => {
      const { data, error } = await db.from("p2p_wallets").select("coin_available,diamond_available,diamond_locked").eq("user_id", user!.id).single();
      if (error) throw error;
      return data as Wallet;
    },
  });
  const rates = useQuery({
    queryKey: ["p2p-rates"],
    queryFn: async () => {
      const { data, error } = await db.from("p2p_exchange_rates").select("currency_code,diamonds_per_fiat_unit,active").eq("active", true).order("currency_code");
      if (error) throw error;
      return (data ?? []) as Rate[];
    },
  });
  const agents = useQuery({
    queryKey: ["p2p-active-sub-agents"],
    queryFn: async () => {
      const { data, error } = await db.from("p2p_profiles").select("user_id,display_name,super_agent_id,active").eq("role", "sub_agent").eq("active", true).order("display_name");
      if (error) throw error;
      return (data ?? []) as Array<Pick<P2PProfile, "user_id" | "display_name" | "super_agent_id" | "active">>;
    },
  });
  const ledger = useQuery({
    queryKey: ["p2p-ledger", user?.id, profile.data?.role],
    enabled: !!user?.id && !!profile.data,
    queryFn: async () => {
      const { data, error } = await db.from("p2p_ledger")
        .select("id,kind,asset,amount,from_user_id,to_user_id,withdrawal_id,created_at,metadata")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; kind: string; asset: string; amount: number; from_user_id: string | null; to_user_id: string | null; withdrawal_id: string | null; created_at: string; metadata: Record<string, unknown> }>;
    },
    refetchInterval: 30_000,
  });
  const withdrawals = useQuery({
    queryKey: ["p2p-my-withdrawals", user?.id, profile.data?.role],
    enabled: !!user?.id && !!profile.data,
    queryFn: async () => {
      let q = db.from("p2p_diamond_withdrawals").select("id,user_id,sub_agent_id,super_agent_id,amount,fiat_currency,fiat_amount,status,created_at,payout_screenshot_path,payout_reference,payout_method,payout_account_name,payout_account_number,rejection_reason").order("created_at", { ascending: false }).limit(50);
      if (profile.data!.role === "sub_agent") q = q.eq("sub_agent_id", user!.id);
      else if (profile.data!.role !== "admin" && profile.data!.role !== "super_agent") q = q.eq("user_id", user!.id);
      else if (profile.data!.role === "super_agent") q = q.eq("super_agent_id", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Withdrawal[];
    },
    refetchInterval: 30_000,
  });

  const refresh = async () => Promise.all([
    qc.invalidateQueries({ queryKey: ["p2p-profile"] }),
    qc.invalidateQueries({ queryKey: ["p2p-wallet"] }),
    qc.invalidateQueries({ queryKey: ["p2p-rates"] }),
    qc.invalidateQueries({ queryKey: ["p2p-my-withdrawals"] }),
    qc.invalidateQueries({ queryKey: ["p2p-active-sub-agents"] }),
    qc.invalidateQueries({ queryKey: ["p2p-my-subagents"] }),
    qc.invalidateQueries({ queryKey: ["p2p-ledger"] }),
    qc.invalidateQueries({ queryKey: ["p2p-user-search"] }),
    qc.invalidateQueries({ queryKey: ["p2p-agent-listing"] }),
    qc.invalidateQueries({ queryKey: ["p2p-agent-marketplace"] }),
  ]);
  const mutation = useMutation({
    mutationFn: async (run: () => Promise<void>) => run(),
    onSuccess: async () => { toast.success("P2P update completed"); await refresh(); },
    onError: (e: Error) => toast.error(errorText(e)),
  });

  async function requestWithdrawal() {
    if (!subAgentId) throw new Error("Choose a Sub-Agent");
    const n = Number(amount);
    if (!Number.isSafeInteger(n) || n <= 0) throw new Error("Enter a positive whole-number diamond amount");
    if (payoutAccountName.trim().length < 2 || payoutAccountNumber.trim().length < 5) throw new Error("Enter the payout account holder name and account/phone number");
    const { error } = await db.rpc("p2p_request_diamond_withdrawal", { p_request_key: newKey(), p_sub_agent_id: subAgentId, p_amount: n, p_fiat_currency: currency, p_payout_method: payoutMethod, p_payout_account_name: payoutAccountName.trim(), p_payout_account_number: payoutAccountNumber.trim() });
    if (error) throw error;
  }
  async function submitProof(row: Withdrawal) {
    const file = proofFiles[row.id];
    if (!file) throw new Error("Select payment screenshot first");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Use PNG, JPG or WEBP image");
    if (file.size > 5 * 1024 * 1024) throw new Error("Screenshot must be 5 MB or smaller");
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = row.id + "/" + newKey() + "." + ext;
    const { error: uploadError } = await supabase.storage.from("payout_screenshots").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { error } = await db.rpc("p2p_submit_diamond_payout", { p_withdrawal_id: row.id, p_screenshot_path: path, p_payout_reference: proofRef[row.id]?.trim() || null });
    if (error) {
      await supabase.storage.from("payout_screenshots").remove([path]);
      throw error;
    }
    setProofFiles((prev) => ({ ...prev, [row.id]: null }));
  }
  async function saveAgentListing() {
    const price = Number(listingPrice);
    if (!Number.isFinite(price) || price <= 0) throw new Error("Enter a valid price per 1,000 coins");
    if (listingWhatsApp.replace(/\\D/g, "").length < 8) throw new Error("Enter a valid WhatsApp number with country code");
    const { error } = await db.rpc("p2p_agent_save_listing", {
      p_country_code: listingCountryCode,
      p_currency_code: listingCurrencyCode,
      p_whatsapp_number: listingWhatsApp,
      p_sell_price_per_1000: price,
      p_listed: listingActive,
    });
    if (error) throw error;
  }
  async function createSubAgent() {
    if (!childUserId.trim()) throw new Error("Search and select a JALWA user first");
    const { error } = await db.rpc("p2p_super_create_sub_agent", {
      p_user_id: childUserId.trim(),
      p_display_name: childDisplayName.trim() || null,
    });
    if (error) throw error;
    setChildUserId("");
    setChildDisplayName("");
    setUserSearch("");
  }
  async function setSubAgentActive(userId: string, active: boolean) {
    const { error } = await db.rpc("p2p_super_set_sub_agent_active", { p_user_id: userId, p_active: active });
    if (error) throw error;
  }
  async function adminAssign() {
    if (!roleUserId.trim()) throw new Error("Enter the user's Supabase UUID");
    const { error } = await db.rpc("p2p_admin_assign_role", { p_user_id: roleUserId.trim(), p_role: role, p_super_agent_id: role === "sub_agent" ? parentId.trim() : null, p_display_name: displayName.trim() || null });
    if (error) throw error;
    if (role === "sub_agent") {
      const { error: locationError } = await db.rpc("p2p_admin_set_agent_location", { p_agent_id: roleUserId.trim(), p_country_code: agentCountryCode.trim().toUpperCase(), p_currency_code: agentCurrencyCode.trim().toUpperCase() });
      if (locationError) throw locationError;
    }
  }
  async function adminRate() {
    const n = Number(rate);
    if (!Number.isFinite(n) || n <= 0) throw new Error("Rate must be greater than zero");
    const { error } = await db.rpc("p2p_admin_set_exchange_rate", { p_currency_code: currency, p_diamonds_per_fiat_unit: n, p_active: true });
    if (error) throw error;
  }
  async function adminGrant() {
    if (!grantUserId.trim()) throw new Error("Enter recipient user UUID");
    const n = Number(grantAmount);
    if (!Number.isSafeInteger(n) || n <= 0) throw new Error("Amount must be a positive whole number");
    const name = grantAsset === "coin" ? "p2p_admin_grant_coins" : "p2p_admin_grant_diamonds";
    const args = grantAsset === "coin" ? { p_request_key: newKey(), p_to_user_id: grantUserId.trim(), p_amount: n } : { p_request_key: newKey(), p_user_id: grantUserId.trim(), p_amount: n, p_source: "admin_manual_grant" };
    const { error } = await db.rpc(name, args);
    if (error) throw error;
  }
  async function transfer() {
    if (!transferTo.trim()) throw new Error("Enter recipient user UUID");
    const n = Number(transferAmount);
    if (!Number.isSafeInteger(n) || n <= 0) throw new Error("Amount must be a positive whole number");
    const { error } = await db.rpc("p2p_transfer_coins", { p_request_key: newKey(), p_to_user_id: transferTo.trim(), p_amount: n });
    if (error) throw error;
  }

  const me = profile.data;
  return <AppShell title="P2P Agency" subtitle="Independent coins, diamonds and agency settlement">
    <main className="mx-auto w-full max-w-5xl space-y-5 px-3 pb-28 pt-4 sm:px-5">
      <section className="rounded-3xl border border-amber-400/25 bg-gradient-to-br from-zinc-950 via-card to-amber-950/30 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">JALWA · P2P MASTER AGENCY</p><h1 className="mt-1 text-2xl font-black">Agency wallet</h1><p className="mt-2 text-sm text-muted-foreground">A separate ledger; legacy coin and withdrawal balances are not changed by this workspace.</p></div><button onClick={() => void refresh()} className="rounded-xl border border-border p-3" aria-label="Refresh P2P data"><RefreshCw className="h-4 w-4"/></button></div>
        {profile.isLoading ? <div className="mt-5 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin"/> Setting up your P2P profile…</div> : profile.isError ? <p className="mt-4 text-sm text-destructive">P2P profile setup failed: {errorText(profile.error)}</p> : <><div className="mt-4 flex flex-wrap items-center gap-2"><span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-black uppercase text-amber-200">{me?.role?.replace("_"," ")}</span><span className="text-xs text-muted-foreground">{me?.display_name || user?.id}</span></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Balance icon={<Coins className="h-4 w-4"/>} label="Available coins" value={wallet.data?.coin_available ?? 0}/><Balance icon={<Gem className="h-4 w-4"/>} label="Available diamonds" value={wallet.data?.diamond_available ?? 0}/><Balance icon={<ShieldCheck className="h-4 w-4"/>} label="Diamonds in escrow" value={wallet.data?.diamond_locked ?? 0}/></div></>}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">Coin Agent Marketplace</h2><p className="mt-1 text-xs text-muted-foreground">Choose a listed Sub-Agent, contact them on WhatsApp, then the agent transfers coins after confirming your payment.</p></div><Field label="Country"><select value={marketCountry} onChange={e=>setMarketCountry(e.target.value)} className={inputClass}><option value="all">All countries</option>{Array.from(new Set((marketplace.data??[]).map(a=>a.country_code))).sort().map(code=><option key={code} value={code}>{code}</option>)}</select></Field></div>
        {marketplace.isLoading?<Loader2 className="mt-4 h-5 w-5 animate-spin"/>:marketplace.isError?<p className="mt-3 text-sm text-destructive">{errorText(marketplace.error)}</p>:(marketplace.data??[]).filter(a=>marketCountry==="all"||a.country_code===marketCountry).length?<div className="mt-4 grid gap-3 sm:grid-cols-2">{(marketplace.data??[]).filter(a=>marketCountry==="all"||a.country_code===marketCountry).map(a=><article key={a.user_id} className="rounded-2xl border border-border bg-background/50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black">Coin Agent · {a.user_id.slice(0,8)}</p><p className="mt-1 text-xs text-muted-foreground">{a.country_code} · {a.currency_code}</p></div><span className="rounded-full border border-amber-400/30 px-2 py-1 text-xs font-black text-amber-300">{a.currency_code} {Number(a.sell_price_per_1000).toLocaleString()} / 1,000</span></div><a href={`https://wa.me/${a.whatsapp_number.replace(/\\D/g,"")}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-white">Contact on WhatsApp</a></article>)}</div>:<p className="mt-4 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">No active Coin Agents are listed yet.</p>}
      </section>
      {me?.role === "sub_agent" && <section className="rounded-2xl border border-border bg-card p-4 sm:p-5"><h2 className="font-black">My Coin Agent Listing</h2><p className="mt-1 text-xs text-muted-foreground">Set your WhatsApp contact and price. Only active listings appear in the user marketplace.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Country"><select value={listingCountryCode} onChange={e=>setListingCountryCode(e.target.value)} className={inputClass}>{[["PK","Pakistan"],["IN","India"],["BD","Bangladesh"],["AE","United Arab Emirates"],["SA","Saudi Arabia"],["US","United States"]].map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></Field><Field label="Currency"><select value={listingCurrencyCode} onChange={e=>setListingCurrencyCode(e.target.value)} className={inputClass}>{["PKR","INR","BDT","AED","SAR","USD"].map(code=><option key={code}>{code}</option>)}</select></Field><Field label="WhatsApp number with country code"><input value={listingWhatsApp} onChange={e=>setListingWhatsApp(e.target.value)} className={inputClass} placeholder="923001234567" maxLength={20}/></Field><Field label="Price per 1,000 coins"><input type="number" min="0.01" step="0.01" value={listingPrice} onChange={e=>setListingPrice(e.target.value)} className={inputClass}/></Field></div><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={listingActive} onChange={e=>setListingActive(e.target.checked)}/>Show my listing in the marketplace</label><button disabled={mutation.isPending} onClick={()=>mutation.mutate(saveAgentListing)} className={primaryClass}>Save Agent Listing</button></section>}
      {me?.role === "user" && <section className="rounded-2xl border border-border bg-card p-4 sm:p-5"><h2 className="font-black">Request diamond withdrawal</h2><p className="mt-1 text-xs text-muted-foreground">Choose a Sub-Agent. Diamonds are locked until their payment proof is reviewed by the assigned Super Agent.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><Field label="Diamonds"><input type="number" min="1" step="1" value={amount} onChange={e=>setAmount(e.target.value)} className={inputClass}/></Field><Field label="Currency"><select value={currency} onChange={e=>setCurrency(e.target.value)} className={inputClass}>{(rates.data ?? []).map(r=><option key={r.currency_code} value={r.currency_code}>{r.currency_code}</option>)}</select></Field><Field label="Sub-Agent"><select value={subAgentId} onChange={e=>setSubAgentId(e.target.value)} className={inputClass}><option value="">Choose agent</option>{(agents.data ?? []).map(a=><option key={a.user_id} value={a.user_id}>{a.display_name || a.user_id.slice(0,8)} · {a.user_id.slice(0,8)}</option>)}</select></Field></div><div className="mt-3 grid gap-3 sm:grid-cols-3"><Field label="Payout method"><select value={payoutMethod} onChange={e=>setPayoutMethod(e.target.value)} className={inputClass}><option>JazzCash</option><option>Easypaisa</option><option>Bank Transfer</option><option>Raast</option><option>Other</option></select></Field><Field label="Account holder name"><input value={payoutAccountName} onChange={e=>setPayoutAccountName(e.target.value)} className={inputClass} maxLength={120} autoComplete="name" required/></Field><Field label="Account / wallet number"><input value={payoutAccountNumber} onChange={e=>setPayoutAccountNumber(e.target.value)} className={inputClass} maxLength={80} autoComplete="off" required/></Field></div><p className="mt-2 text-xs text-muted-foreground">Payout details are shared only with the assigned Sub-Agent/Super Agent to process this request. Estimated payout: {currency} {(()=>{const r=(rates.data??[]).find(x=>x.currency_code===currency);return r ? (Number(amount)/Number(r.diamonds_per_fiat_unit)).toFixed(2) : "—"})()}</p><button disabled={mutation.isPending || !agents.data?.length} onClick={()=>mutation.mutate(requestWithdrawal)} className={primaryClass}>Lock diamonds & create request</button></section>}

      {(me?.role === "sub_agent" || me?.role === "super_agent") && <section className="rounded-2xl border border-border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-black">Agency settlement</h2><p className="mt-1 text-xs text-muted-foreground">Sub-Agent pays the user externally and submits proof. Super Agent reviews proof before diamonds are released.</p></div>{me?.role === "super_agent" && <Link to="/agency-approvals" className="rounded-xl bg-amber-400 px-3 py-2 text-sm font-black text-black">Open approvals</Link>}</div>
      {me?.role === "super_agent" && <div className="mt-4 rounded-xl border border-border bg-background/50 p-4">
        <div className="flex items-center justify-between gap-3"><div><h3 className="font-black">My Coin Agents</h3><p className="mt-1 text-xs text-muted-foreground">Create and manage up to five Sub-Agents under your agency.</p></div><span className="rounded-full border border-amber-400/30 px-3 py-1 text-xs font-black text-amber-300">{mySubAgents.data?.length ?? 0}/5</span></div>
        {(mySubAgents.data?.length ?? 0) < 5 && <div className="mt-3 space-y-2">
          <label className="block text-xs font-bold text-muted-foreground">Find user by username or JALWA ID<input value={userSearch} onChange={e=>setUserSearch(e.target.value)} className={inputClass} placeholder="Enter username or JALWA ID"/></label>
          {userSearchResults.data?.map(u=><button key={u.id} type="button" onClick={()=>{setChildUserId(u.id);setChildDisplayName(u.username||"");}} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-xs ${childUserId===u.id?"border-amber-400 bg-amber-400/10":"border-border"}`}><span><strong>{u.username||"JALWA user"}</strong><span className="ml-2 text-muted-foreground">{u.user_code||"No JALWA ID"}</span><span className="mt-1 block break-all text-[10px] text-muted-foreground">{u.id}</span></span><span>{childUserId===u.id?"Selected":"Select"}</span></button>)}
          <label className="block text-xs font-bold text-muted-foreground">Agent display name (optional)<input value={childDisplayName} onChange={e=>setChildDisplayName(e.target.value)} className={inputClass} maxLength={80} placeholder="Coin Agent name"/></label>
          <button disabled={mutation.isPending||!childUserId} onClick={()=>mutation.mutate(createSubAgent)} className={primaryClass}>Create Coin Agent</button>
        </div>}
        <div className="mt-4 space-y-2">{(mySubAgents.data??[]).map(a=><article key={a.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"><div><p className="text-sm font-bold">{a.display_name||"Coin Agent"}</p><p className="break-all text-[10px] text-muted-foreground">{a.user_id}</p><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${a.active?"bg-emerald-500/10 text-emerald-400":"bg-zinc-500/10 text-zinc-400"}`}>{a.active?"Active":"Inactive"}</span></div><button disabled={mutation.isPending} onClick={()=>mutation.mutate(()=>setSubAgentActive(a.user_id,!a.active))} className={secondaryClass}>{a.active?"Deactivate":"Reactivate"}</button></article>)}</div>
        {(mySubAgents.data?.length ?? 0)>=5 && <p className="mt-3 text-xs text-amber-300">The five-agent limit has been reached. Existing agents can still be managed.</p>}
      </div>}
      <p className="mt-3 text-xs text-muted-foreground">Your assigned approval queue is available in the approvals dashboard.</p>
      {me?.role === "sub_agent" && <div className="mt-4 space-y-3">{(withdrawals.data??[]).filter(w=>w.status==="pending_payment").map(w=><article key={w.id} className="rounded-xl border border-border p-3"><p className="text-sm font-bold">{Number(w.amount).toLocaleString()} diamonds · {w.fiat_currency} {Number(w.fiat_amount).toFixed(2)}</p><p className="mt-1 break-all text-xs text-muted-foreground">Request {w.id} · User {w.user_id}</p><div className="mt-3 rounded-xl border border-border bg-background/60 p-3 text-sm"><p><span className="text-muted-foreground">Send via:</span> <strong>{w.payout_method || "—"}</strong></p><p className="mt-1"><span className="text-muted-foreground">Account name:</span> <strong>{w.payout_account_name || "—"}</strong></p><p className="mt-1 break-all"><span className="text-muted-foreground">Account / wallet:</span> <strong>{w.payout_account_number || "—"}</strong></p></div><label className="mt-3 block text-xs font-bold">Payment screenshot (required)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setProofFiles(p=>({...p,[w.id]:e.target.files?.[0]??null}))} className="mt-1 block w-full text-xs"/></label><label className="mt-3 block text-xs font-bold">Payment reference (optional)<input value={proofRef[w.id]??""} onChange={e=>setProofRef(p=>({...p,[w.id]:e.target.value}))} className={inputClass} maxLength={160}/></label><button disabled={mutation.isPending} onClick={()=>mutation.mutate(()=>submitProof(w))} className={primaryClass}><Upload className="mr-2 inline h-4 w-4"/>Submit proof to Super Agent</button></article>)}{!withdrawals.data?.some(w=>w.status==="pending_payment") && <p className="text-sm text-muted-foreground">No user requests waiting for payment.</p>}</div>}</section>}

      {me?.role === "admin" && <section className="space-y-4"><div className="rounded-2xl border border-border bg-card p-4 sm:p-5"><h2 className="flex items-center gap-2 font-black"><Users className="h-4 w-4"/>Assign P2P role</h2><p className="mt-1 text-xs text-muted-foreground">Search a username or JALWA ID, select the user, then assign a P2P role. Sub-Agents must belong to an active Super Agent.</p><label className="mt-3 block text-xs font-bold text-muted-foreground">Find user<input value={userSearch} onChange={e=>setUserSearch(e.target.value)} className={inputClass} placeholder="Username, JALWA ID or UUID"/></label>{userSearchResults.data?.map(u=><button key={u.id} type="button" onClick={()=>setRoleUserId(u.id)} className={`mt-2 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs ${roleUserId===u.id?"border-amber-400 bg-amber-400/10":"border-border"}`}><span><strong>{u.username||"JALWA user"}</strong><span className="ml-2 text-muted-foreground">{u.user_code||"No JALWA ID"}</span><span className="mt-1 block break-all text-[10px] text-muted-foreground">{u.id}</span></span><span>{roleUserId===u.id?"Selected":"Select"}</span></button>)}<div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="User UUID"><input value={roleUserId} onChange={e=>setRoleUserId(e.target.value)} className={inputClass}/></Field><Field label="Role"><select value={role} onChange={e=>setRole(e.target.value as any)} className={inputClass}><option value="user">Normal user</option><option value="super_agent">Super Agent</option><option value="sub_agent">Sub-Agent</option></select></Field>{role==="sub_agent" && <><Field label="Parent Super Agent UUID"><input value={parentId} onChange={e=>setParentId(e.target.value)} className={inputClass}/></Field><Field label="Agent country ISO-2"><input value={agentCountryCode} maxLength={2} onChange={e=>setAgentCountryCode(e.target.value)} className={inputClass}/></Field><Field label="Agent currency ISO-3"><input value={agentCurrencyCode} maxLength={3} onChange={e=>setAgentCurrencyCode(e.target.value)} className={inputClass}/></Field></>}<Field label="Display name (optional)"><input value={displayName} onChange={e=>setDisplayName(e.target.value)} className={inputClass}/></Field></div><button disabled={mutation.isPending} onClick={()=>mutation.mutate(adminAssign)} className={primaryClass}>Save role assignment</button></div>
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5"><h2 className="font-black">Exchange rate</h2><p className="mt-1 text-xs text-muted-foreground">Diamonds per one unit of fiat currency. Payout is calculated on the server.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Currency code"><select value={currency} onChange={e=>setCurrency(e.target.value)} className={inputClass}>{["PKR","USD","INR","BDT","AED","SAR"].map(c=><option key={c}>{c}</option>)}</select></Field><Field label="Diamonds per 1 currency unit"><input type="number" min="0.00000001" step="any" value={rate} onChange={e=>setRate(e.target.value)} className={inputClass}/></Field></div><button disabled={mutation.isPending} onClick={()=>mutation.mutate(adminRate)} className={primaryClass}>Save rate</button></div>
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5"><h2 className="font-black">Audited manual grant</h2><p className="mt-1 text-xs text-muted-foreground">Admin-only initial balances and corrections. Every grant creates a ledger entry.</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><Field label="Recipient UUID"><input value={grantUserId} onChange={e=>setGrantUserId(e.target.value)} className={inputClass}/></Field><Field label="Asset"><select value={grantAsset} onChange={e=>setGrantAsset(e.target.value as any)} className={inputClass}><option value="coin">P2P coins</option><option value="diamond">Diamonds</option></select></Field><Field label="Amount"><input type="number" min="1" step="1" value={grantAmount} onChange={e=>setGrantAmount(e.target.value)} className={inputClass}/></Field></div><button disabled={mutation.isPending} onClick={()=>mutation.mutate(adminGrant)} className={primaryClass}>Grant balance</button></div></section>}

      {(me?.role === "admin" || me?.role === "super_agent" || me?.role === "sub_agent") && <section className="rounded-2xl border border-border bg-card p-4 sm:p-5"><h2 className="font-black">Transfer P2P coins</h2><p className="mt-1 text-xs text-muted-foreground">Server enforces hierarchy: Admin → Super Agent → assigned Sub-Agent → user.</p><label className="mt-3 block text-xs font-bold text-muted-foreground">Find recipient by username or JALWA ID<input value={recipientSearch} onChange={e=>setRecipientSearch(e.target.value)} className={inputClass} placeholder="Username, JALWA ID or UUID"/></label>{recipientSearchResults.data?.map(u=><button key={u.id} type="button" onClick={()=>setTransferTo(u.id)} className={`mt-2 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs ${transferTo===u.id?"border-amber-400 bg-amber-400/10":"border-border"}`}><span><strong>{u.username||"JALWA user"}</strong><span className="ml-2 text-muted-foreground">{u.user_code||"No JALWA ID"}</span><span className="mt-1 block break-all text-[10px] text-muted-foreground">{u.id}</span></span><span>{transferTo===u.id?"Selected":"Select"}</span></button>)}<div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Recipient UUID"><input value={transferTo} onChange={e=>setTransferTo(e.target.value)} className={inputClass}/></Field><Field label="Amount"><input type="number" min="1" step="1" value={transferAmount} onChange={e=>setTransferAmount(e.target.value)} className={inputClass}/></Field></div><button disabled={mutation.isPending} onClick={()=>mutation.mutate(transfer)} className={primaryClass}><ArrowLeftRight className="mr-2 inline h-4 w-4"/>Transfer coins</button></section>}

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5"><div className="flex items-center justify-between"><h2 className="font-black">Recent withdrawals</h2><button onClick={()=>void withdrawals.refetch()} className="text-xs font-bold text-amber-300">Refresh</button></div>{withdrawals.isLoading ? <Loader2 className="mt-4 h-5 w-5 animate-spin"/> : (withdrawals.data??[]).length ? <div className="mt-3 space-y-2">{withdrawals.data!.map(w=><article key={w.id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{Number(w.amount).toLocaleString()} diamonds · {w.fiat_currency} {Number(w.fiat_amount).toFixed(2)}</strong><span className="rounded-full border border-border px-2 py-1 text-[10px] font-bold uppercase">{w.status.replaceAll("_"," ")}</span></div><p className="mt-1 break-all text-[11px] text-muted-foreground">{w.id} · {new Date(w.created_at).toLocaleString()}</p>{w.rejection_reason && <p className="mt-2 text-xs text-destructive">Reason: {w.rejection_reason}</p>}</article>)}</div> : <p className="mt-3 text-sm text-muted-foreground">No withdrawal records yet.</p>}</section>
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-black">P2P Ledger</h2><p className="mt-1 text-xs text-muted-foreground">Audited activity from the new agency economy.</p></div><button onClick={()=>void ledger.refetch()} className="text-xs font-bold text-amber-300">Refresh</button></div>{ledger.isLoading?<Loader2 className="mt-4 h-5 w-5 animate-spin"/>:ledger.isError?<p className="mt-3 text-sm text-destructive">{errorText(ledger.error)}</p>:(ledger.data??[]).length?<div className="mt-3 space-y-2">{ledger.data!.map(item=><article key={item.id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{item.kind.replaceAll("_"," ")}</strong><span className="rounded-full border border-border px-2 py-1 text-[10px] font-bold uppercase">{item.asset} · {Number(item.amount).toLocaleString()}</span></div><p className="mt-1 break-all text-[10px] text-muted-foreground">{item.from_user_id?(`From ${item.from_user_id}`):"System"}{item.to_user_id?(` · To ${item.to_user_id}`):""}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p></article>)}</div>:<p className="mt-3 text-sm text-muted-foreground">No P2P ledger activity yet.</p>}</section>
      <Link to="/me" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><span>←</span> Back to profile</Link>
    </main><BottomNav/>
  </AppShell>;
}

const inputClass = "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-amber-400";
const primaryClass = "mt-4 inline-flex items-center justify-center rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-zinc-950 disabled:opacity-50";
const secondaryClass = "rounded-xl border border-border px-3 py-2 text-xs font-bold disabled:opacity-50";
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-xs font-bold text-muted-foreground">{label}{children}</label>; }
function Balance({ icon, label, value }: { icon: ReactNode; label: string; value: number }) { return <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2 text-xs text-zinc-400">{icon}{label}</div><p className="mt-2 text-2xl font-black text-amber-300">{Number(value).toLocaleString()}</p></div>; }
