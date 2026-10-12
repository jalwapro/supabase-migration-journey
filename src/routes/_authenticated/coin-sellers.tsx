import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { CoinAgentHub } from "@/components/coin-agent/CoinAgentHub";
import { AgentDashboard } from "@/components/p2p/AgentDashboard";
import { CoinInventoryRequests } from "@/components/coin-agent/CoinInventoryRequests";
import { SuperCoinAgentPanel } from "@/components/coin-agent/SuperCoinAgentPanel";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, BadgeCheck, Coins , ExternalLink, Loader2, MessageCircle, Search, ShieldCheck, Store, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/coin-sellers")({ component: CoinSellerMarketplaceRoute });
function CoinSellerMarketplaceRoute() {
  const { user, isAdmin } = useAuth();
  const access = useQuery({
    queryKey: ["coin-agent-workspace-access", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coin_sellers")
        .select("user_id")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    staleTime: 30_000,
    retry: 1,
  });

  if (access.isLoading) {
    return <AppShell title="Coin Agent Panel"><div className="mx-auto flex min-h-[50vh] max-w-lg items-center justify-center gap-3 p-6 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Checking Coin Agent access…</div></AppShell>;
  }

  if (!user || (!isAdmin && access.data !== true)) {
    return <AppShell title="Coin Agent Panel"><main className="mx-auto max-w-lg p-6"><section className="rounded-2xl border border-border bg-card p-5 text-center"><Store className="mx-auto h-10 w-10 text-muted-foreground" /><h1 className="mt-3 text-xl font-black">Coin Agent access required</h1><p className="mt-2 text-sm text-muted-foreground">This workspace is only available to approved, active Coin Agents. Normal user accounts cannot access seller inventory, payment settings or customer transfers.</p><a href="/me" className="mt-5 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Back to Profile</a></section></main></AppShell>;
  }

  return <>
    <AppShell title="Coin Agent Workspace" subtitle="Diamonds, coin stock, customer transfers, payment settings and settlements">
      <main className="mx-auto w-full max-w-6xl space-y-5 px-3 pb-28 pt-4 sm:px-5">
        <SuperCoinAgentPanel />
        <section className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-zinc-950 via-card to-amber-950/30 p-4 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">JALWA · MERCHANT WORKSPACE</p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">Coin Agent Panel</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your diamond buying price, coin inventory, transfers by JALWA ID, payment methods, WhatsApp, orders and settlements in one place.</p>
          <nav aria-label="Coin Agent sections" className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <a href="#agent-diamonds" className="shrink-0 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-200">Diamonds & price</a>
            <a href="#agent-inventory" className="shrink-0 rounded-full border border-border bg-background/70 px-3 py-2 text-xs font-bold">Coin inventory</a>
            <a href="#agent-inventory-requests" className="shrink-0 rounded-full border border-border bg-background/70 px-3 py-2 text-xs font-bold">Inventory requests</a>
            <a href="#agent-orders" className="shrink-0 rounded-full border border-border bg-background/70 px-3 py-2 text-xs font-bold">Orders & payments</a>
          </nav>
        </section>
        <section id="agent-diamonds" aria-label="Diamond trades and agent pricing" className="scroll-mt-20">
          <CoinAgentHub />
        </section>
        <section id="agent-inventory" aria-label="Coin inventory and customer transfers" className="scroll-mt-20 rounded-2xl border border-border bg-card p-2 sm:p-3">
          <div className="px-2 pt-2">
            <h2 className="text-lg font-black">Coin inventory & customer transfers</h2>
            <p className="mt-1 text-xs text-muted-foreground">Check your stock, transfer coins to a customer’s JALWA ID and review inventory transactions.</p>
          </div>
          <CoinSellerMarketplace embedded />
        </section>
        <section id="agent-inventory-requests" aria-label="Coin inventory requests and economy controls" className="scroll-mt-20">
          <CoinInventoryRequests />
        </section>
        <section id="agent-orders" aria-label="Payment methods and P2P orders" className="scroll-mt-20 rounded-2xl border border-border bg-card p-2 sm:p-3">
          <div className="px-2 pt-2">
            <h2 className="text-lg font-black">P2P orders, payment methods & WhatsApp</h2>
            <p className="mt-1 text-xs text-muted-foreground">Save payment details, request WhatsApp updates and manage orders.</p>
          </div>
          <AgentDashboard />
        </section>
      </main>
    </AppShell>
    <BottomNav />
  </>;
}

type PublicSeller = { user_id: string; whatsapp_number: string | null; public_name: string | null; public_note: string | null; is_active: boolean; is_listed: boolean; available_coins?: number; profile?: { username: string | null; user_code: string | null; avatar: string | null } | null };
type SellerInventory = { seller_id: string; available_coins: number; total_allocated: number; total_sold: number };
type SellerTransaction = { id: string; seller_id: string; buyer_id: string | null; kind: string; coins: number; inventory_delta: number; seller_balance_after: number; buyer_balance_after: number | null; payment_reference: string | null; note: string | null; created_at: string; buyer?: { username: string | null; user_code: string | null } | null; seller?: { username: string | null; user_code: string | null } | null };

export function CoinSellerMarketplace({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [buyerCode, setBuyerCode] = useState("");
  const [amount, setAmount] = useState("1000");
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [transferRequestKey, setTransferRequestKey] = useState(() => globalThis.crypto?.randomUUID?.() ?? "transfer-" + Date.now() + "-" + Math.random().toString(36).slice(2));

  const myProfile = useQuery({ queryKey: ["coin_seller_my_profile", user?.id], enabled: !!user?.id, queryFn: async () => { const { data, error } = await supabase.from("profiles").select("username,user_code").eq("id", user!.id).single(); if (error) throw error; return data; }, staleTime: 60_000 });

  const directory = useQuery({
    queryKey: ["coin_seller_public_directory"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coin_sellers").select("user_id,whatsapp_number,public_name,public_note,is_active,is_listed").eq("is_active", true).eq("is_listed", true).order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as PublicSeller[];
      if (!rows.length) return rows;
      const [{ data: profiles, error: profileError }, { data: inventories, error: inventoryError }] = await Promise.all([
        supabase.from("profiles").select("id,username,user_code,avatar").in("id", rows.map((r) => r.user_id)),
        supabase.from("coin_seller_inventory").select("seller_id,available_coins").in("seller_id", rows.map((r) => r.user_id)),
      ]);
      if (profileError) throw profileError;
      if (inventoryError) throw inventoryError;
      const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const iMap = new Map((inventories ?? []).map((i) => [i.seller_id, Number(i.available_coins)]));
      return rows.map((r) => ({ ...r, profile: pMap.get(r.user_id) ?? null, available_coins: iMap.get(r.user_id) ?? 0 }));
    },
    staleTime: 30_000,
  });

  const inventory = useQuery({
    queryKey: ["my_coin_seller_inventory", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("coin_seller_inventory").select("seller_id,available_coins,total_allocated,total_sold").eq("seller_id", user!.id).maybeSingle();
      if (error) throw error;
      return data as SellerInventory | null;
    },
    staleTime: 10_000,
  });

  const transactionHistory = useQuery({
    queryKey: ["my_coin_seller_transactions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("coin_seller_transactions").select("*").or(`seller_id.eq.${user!.id},buyer_id.eq.${user!.id}`).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      const rows = (data ?? []) as SellerTransaction[];
      const profileIds = [...new Set(rows.flatMap((r) => [r.seller_id, r.buyer_id].filter((id): id is string => !!id)))];
      if (!profileIds.length) return rows;
      const { data: profiles, error: profileError } = await supabase.from("profiles").select("id,username,user_code").in("id", profileIds);
      if (profileError) throw profileError;
      const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({ ...r, seller: pMap.get(r.seller_id) ?? null, buyer: r.buyer_id ? pMap.get(r.buyer_id) ?? null : null }));
    },
    staleTime: 10_000,
  });

  const transfer = useMutation({
    mutationFn: async () => {
      if (!confirmTransfer) throw new Error("Review and confirm the transfer first.");
      const coins = Number(amount);
      if (!Number.isSafeInteger(coins) || coins < 1 || coins > 1_000_000) throw new Error("Enter between 1 and 1,000,000 coins.");
      const transferRpc = supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
      const { data, error } = await transferRpc("coin_seller_transfer", { p_buyer_code: buyerCode.trim(), p_coins: coins, p_request_key: transferRequestKey, p_payment_reference: paymentReference.trim() });
      if (error) throw error;
      if (!data || typeof data !== "object" || !("transaction_id" in data) || !("coins_transferred" in data)) {
        throw new Error("Transfer response was incomplete. Refresh the page and verify the transaction history before retrying.");
      }
      return data as { transaction_id: string; buyer_username: string | null; buyer_code: string | null; coins_transferred: number; buyer_balance_after: number; seller_balance_after: number };
    },
    onSuccess: (result) => {
      toast.success(`Transferred ${Number(result.coins_transferred).toLocaleString()} coins to ${result.buyer_username || result.buyer_code || "buyer"}`);
      setBuyerCode(""); setPaymentReference(""); setConfirmTransfer(false);
      setTransferRequestKey(globalThis.crypto?.randomUUID?.() ?? "transfer-" + Date.now() + "-" + Math.random().toString(36).slice(2));
      qc.invalidateQueries({ queryKey: ["my_coin_seller_inventory"] });
      qc.invalidateQueries({ queryKey: ["my_coin_seller_transactions"] });
      qc.invalidateQueries({ queryKey: ["my_wallet"] });
      qc.invalidateQueries({ queryKey: ["coin_seller_public_directory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visibleSellers = (directory.data ?? []).filter((s) => `${s.public_name ?? ""} ${s.profile?.username ?? ""} ${s.profile?.user_code ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const isSeller = !!inventory.data;

  const content = <main className="mx-auto w-full max-w-6xl space-y-6 px-3 pb-24 pt-5 sm:px-5 md:pt-7">
    <section className="relative isolate overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-background to-orange-500/5 p-5 sm:p-7"><div className="pointer-events-none absolute -right-12 -top-12 -z-10 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" /><div className="flex items-start gap-3"><button onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign("/")} aria-label="Go back" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-background/70"><ArrowLeft className="h-4 w-4" /></button><div className="min-w-0 flex-1"><p className="text-[11px] font-extrabold uppercase tracking-[.24em] text-amber-400">JALWA • VIP MERCHANT LOUNGE</p><h1 className="mt-1 bg-gradient-to-r from-amber-200 via-yellow-400 to-orange-500 bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl">Coin Bank</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Buy JALWA coins from listed sellers. Confirm payment details directly with your seller before paying.</p><div className="mt-4 flex flex-wrap gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400"><ShieldCheck className="h-3.5 w-3.5" /> Listed sellers</span><span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-300"><Coins className="h-3.5 w-3.5" /> Live stock</span></div></div><div className="hidden h-14 w-14 shrink-0 place-items-center rounded-2xl border border-amber-400/20 bg-amber-400/10 sm:grid"><Coins className="h-7 w-7 text-amber-400" /></div></div></section>

    {isSeller && <section className="relative overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 via-card to-indigo-500/5 p-4 shadow-lg shadow-violet-950/10 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">Your available seller inventory</p><p className="mt-1 flex items-center gap-2 text-2xl font-bold"><Coins className="h-5 w-5 text-primary" />{Number(inventory.data?.available_coins ?? 0).toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">Lifetime sold: {Number(inventory.data?.total_sold ?? 0).toLocaleString()}</p></div><BadgeCheck className="h-8 w-8 text-primary" /></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-[11px] font-bold uppercase tracking-[.16em] text-cyan-300/80">Buyer JALWA ID</label><input value={buyerCode} onChange={(e) => { setBuyerCode(e.target.value); setConfirmTransfer(false); setTransferRequestKey(globalThis.crypto?.randomUUID?.() ?? "transfer-" + Date.now() + "-" + Math.random().toString(36).slice(2)); }} placeholder="Enter user ID or username" className="w-full border-0 border-b-2 border-slate-700 bg-transparent px-1 py-3 text-base outline-none transition focus:border-cyan-400" /></div><div><label className="mb-1 block text-[11px] font-bold uppercase tracking-[.16em] text-amber-300/80">Coin volume</label><input type="number" min="1" max="1000000" value={amount} onChange={(e) => { setAmount(e.target.value); setConfirmTransfer(false); setTransferRequestKey(globalThis.crypto?.randomUUID?.() ?? "transfer-" + Date.now() + "-" + Math.random().toString(36).slice(2)); }} className="w-full border-0 border-b-2 border-slate-700 bg-transparent px-1 py-3 text-2xl font-black text-amber-300 outline-none transition focus:border-amber-400" /></div></div>
      <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Transfer amount</span><strong>{(Number(amount) || 0).toLocaleString()} coins</strong></div><div className="mt-1 flex justify-between"><span className="text-muted-foreground">Inventory after transfer</span><strong>{(Number(inventory.data?.available_coins ?? 0) - (Number(amount) || 0)).toLocaleString()} coins</strong></div></div>
      <label className="mt-3 block text-[11px] font-bold uppercase tracking-[.16em] text-amber-300/80">Payment transaction reference</label>
      <input value={paymentReference} onChange={(e) => { setPaymentReference(e.target.value); setConfirmTransfer(false); setTransferRequestKey(globalThis.crypto?.randomUUID?.() ?? "transfer-" + Date.now() + "-" + Math.random().toString(36).slice(2)); }} maxLength={160} placeholder="JazzCash / Easypaisa / bank reference" className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none focus:border-amber-400/50" />
      <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={confirmTransfer} onChange={(e) => setConfirmTransfer(e.target.checked)} className="mt-0.5" /><span>I have received/verified the buyer's payment and confirm this coin transfer. The reference will be stored in the audit history.</span></label>
      <button disabled={transfer.isPending || !confirmTransfer || !buyerCode.trim() || paymentReference.trim().length < 3 || !Number.isSafeInteger(Number(amount)) || Number(amount) < 1 || Number(amount) > Number(inventory.data?.available_coins ?? 0)} onClick={() => transfer.mutate()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-3.5 text-sm font-black tracking-wide text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:brightness-110 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50">{transfer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Confirm and transfer coins</button>
      <p className="mt-2 text-[11px] text-muted-foreground">Transfers are instant and irreversible. Verify the buyer ID and payment before confirming.</p>
    </section>}

    <section className="space-y-3"><div className="flex items-center gap-3"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by seller name or JALWA ID..." className="w-full rounded-2xl border border-border/80 bg-card/80 py-3 pl-9 pr-4 text-sm shadow-sm outline-none transition focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/10" /></div><span className="shrink-0 text-xs text-muted-foreground">{visibleSellers.length} sellers</span></div>
      {directory.isLoading ? <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : directory.isError ? <div className="glass rounded-xl p-5 text-sm text-destructive">Could not load seller directory. Please try again.</div> : visibleSellers.length === 0 ? <div className="glass rounded-2xl p-8 text-center"><Store className="mx-auto h-10 w-10 text-muted-foreground" /><h2 className="mt-3 font-bold">No sellers available</h2><p className="mt-1 text-sm text-muted-foreground">Please check again later.</p></div> : <div className="grid gap-3 md:grid-cols-2">{visibleSellers.map((s) => { const phone = String(s.whatsapp_number ?? "").replace(/\D/g, ""); const wa = `https://wa.me/${phone}?text=${encodeURIComponent(`Assalam-o-Alaikum, I want to buy JALWA coins. My JALWA ID is ${myProfile.data?.user_code || myProfile.data?.username || "not available"}.`)}`; const inStock = Number(s.available_coins ?? 0) > 0; return <article key={s.user_id} className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-slate-950/80 to-indigo-950/30 p-4 shadow-lg shadow-black/20 transition duration-200 hover:-translate-y-0.5 hover:border-amber-400/40 hover:shadow-xl hover:shadow-amber-950/20 sm:p-5"><div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-400/10 blur-2xl transition group-hover:bg-amber-400/20" /><div className="flex items-start gap-3"><div className="relative grid h-14 w-14 shrink-0 place-items-center"><span className="absolute inset-0 rounded-full bg-amber-400/30 blur-md transition group-hover:bg-amber-400/50" /><div className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-full border border-amber-400/30 bg-gradient-to-br from-slate-900 to-indigo-950 ring-1 ring-white/10">{s.profile?.avatar ? <img src={s.profile.avatar} alt="" className="h-full w-full object-cover" /> : <Store className="h-6 w-6 text-amber-300" />}</div></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{s.public_name || s.profile?.username || "JALWA Seller"}</h2><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${inStock ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-zinc-400"}`}>{inStock ? <><BadgeCheck className="mr-1 inline h-3 w-3" />In stock</> : "Out of stock"}</span></div><p className="mt-1 text-xs text-muted-foreground">JALWA ID: {s.profile?.user_code || "—"}</p><p className={`mt-1 text-xs font-semibold ${inStock ? "text-primary" : "text-muted-foreground"}`}>{Number(s.available_coins ?? 0).toLocaleString()} coins available</p>{s.public_note && <p className="mt-2 text-xs text-muted-foreground">{s.public_note}</p>}</div></div>{inStock ? <a href={wa} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-green-950/20 transition hover:brightness-110 active:scale-[.99]"><MessageCircle className="h-4 w-4" /> Chat on WhatsApp <ExternalLink className="h-3 w-3" /></a> : <button type="button" disabled className="mt-4 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-border bg-muted px-4 py-3 text-sm font-bold text-muted-foreground"><MessageCircle className="h-4 w-4" /> Seller is out of stock</button>}<p className="mt-2 text-[10px] text-muted-foreground">Confirm the price and payment details with the seller before sending money.</p></article>})}</div>}
    </section>

    {transactionHistory.data && transactionHistory.data.length > 0 && <section className="glass rounded-2xl p-4"><h2 className="mb-3 flex items-center gap-2 font-bold"><Wallet className="h-4 w-4 text-primary" /> Your coin seller transactions</h2><div className="space-y-2">{transactionHistory.data.slice(0, 20).map((t) => <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border p-3"><div className={`grid h-9 w-9 place-items-center rounded-full ${t.kind === "sale" ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"}`}><Coins className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{t.kind === "sale" ? (t.seller_id === user?.id ? `Sold to ${t.buyer?.username || t.buyer?.user_code || "buyer"}` : `Received from ${t.seller?.username || t.seller?.user_code || "seller"}`) : t.kind === "allocation" ? "Admin inventory allocation" : "Inventory adjustment"}</p><p className="text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p></div><div className="text-right"><p className={`text-sm font-bold ${t.kind === "sale" ? "text-amber-400" : "text-emerald-400"}`}>{t.kind === "sale" ? "−" : "+"}{Number(t.coins).toLocaleString()}</p><p className="text-[10px] text-muted-foreground">coins</p></div></div>)}</div></section>}
    <p className="text-center text-[11px] text-muted-foreground">JALWA does not collect seller payments. Pay only after verifying the seller and their payment details.</p>
  </main>;
  return embedded ? content : <AppShell>{content}</AppShell>;
}
