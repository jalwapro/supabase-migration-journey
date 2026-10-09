import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { BadgeCheck, Coins, Loader2, MessageCircle, Plus, Search, ShieldCheck, Store, Trash2, CreditCard, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/coin-sellers")({ component: CoinSellersAdmin });

type Seller = {
  user_id: string; whatsapp_number: string; public_name: string | null; public_note: string | null;
  is_active: boolean; is_listed: boolean; created_at: string;
  profile?: { username: string | null; user_code: string | null; avatar: string | null } | null;
  inventory?: { available_coins: number; total_allocated: number; total_sold: number } | null;
};
type Profile = { id: string; username: string | null; user_code: string | null; avatar: string | null };
type AdminTx = { id: string; seller_id: string; buyer_id: string | null; kind: string; coins: number; inventory_delta: number; seller_balance_after: number; buyer_balance_after: number | null; payment_reference: string | null; note: string | null; created_at: string; seller?: Profile | null; buyer?: Profile | null };
type FundingAudit = { id: string; seller_id: string; amount_pkr: number; coins_credited: number; coins_per_pkr: number; payment_method: string; payment_reference: string; note: string | null; inventory_before: number; inventory_after: number; verified_by: string; verified_at: string; seller?: Profile | null; verifier?: Profile | null };

function CoinSellersAdmin() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [publicName, setPublicName] = useState("");
  const [note, setNote] = useState("");
  const [stock, setStock] = useState("0");
  const [paymentReference, setPaymentReference] = useState("");
  const [stockNote, setStockNote] = useState("");
  const [selectedSeller, setSelectedSeller] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [fundingAmount, setFundingAmount] = useState("");
  const [fundingCoins, setFundingCoins] = useState("");
  const [fundingMethod, setFundingMethod] = useState("jazzcash");
  const [fundingReference, setFundingReference] = useState("");
  const [fundingNote, setFundingNote] = useState("");
  const [fundingSeller, setFundingSeller] = useState("");

  const sellers = useQuery({
    queryKey: ["admin_coin_sellers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coin_sellers").select("user_id,whatsapp_number,public_name,public_note,is_active,is_listed,created_at").order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as Seller[];
      if (!rows.length) return rows;
      const ids = rows.map((r) => r.user_id);
      const [{ data: profiles, error: profileError }, { data: inventories, error: inventoryError }] = await Promise.all([
        supabase.from("profiles").select("id,username,user_code,avatar").in("id", ids),
        supabase.from("coin_seller_inventory").select("seller_id,available_coins,total_allocated,total_sold").in("seller_id", ids),
      ]);
      if (profileError) throw profileError;
      if (inventoryError) throw inventoryError;
      const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const iMap = new Map((inventories ?? []).map((i) => [i.seller_id, i]));
      return rows.map((r) => ({ ...r, profile: pMap.get(r.user_id) ?? null, inventory: iMap.get(r.user_id) ?? null }));
    },
    staleTime: 15_000,
  });

  const searchUsers = useQuery({
    queryKey: ["coin_seller_user_search", userSearch.trim()],
    enabled: userSearch.trim().length >= 2,
    queryFn: async () => {
      const q = userSearch.trim().replace(/^@/, "");
      const { data, error } = await supabase.from("profiles").select("id,username,user_code,avatar").or(`username.ilike.%${q}%,user_code.eq.${q}`).limit(8);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const assign = useMutation({
    mutationFn: async (profile: Profile) => {
      const number = whatsapp.replace(/\D/g, "");
      if (number.length < 8 || number.length > 15) throw new Error("Enter WhatsApp with country code, digits only (8–15 digits).");
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const { error } = await supabase.from("coin_sellers").upsert({
        user_id: profile.id, whatsapp_number: number, public_name: publicName.trim() || null,
        public_note: note.trim() || null, is_active: true, is_listed: true, assigned_by: authData.user?.id ?? null,
      }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Seller assigned and listed"); setWhatsapp(""); setPublicName(""); setNote(""); setUserSearch(""); setSelectedUserId(""); qc.invalidateQueries({ queryKey: ["admin_coin_sellers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSeller = useMutation({
    mutationFn: async ({ seller, patch }: { seller: Seller; patch: Partial<Pick<Seller, "whatsapp_number" | "public_name" | "public_note" | "is_active" | "is_listed">> }) => {
      const { error } = await supabase.from("coin_sellers").update(patch).eq("user_id", seller.user_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_coin_sellers"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const adjustStock = useMutation({
    mutationFn: async () => {
      const amount = Number(stock);
      if (!selectedSeller) throw new Error("Choose a seller first.");
      if (!Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > 1_000_000_000) throw new Error("Enter a valid non-zero whole coin amount.");
      if (amount > 0) throw new Error("For new stock, use the Verified Payment & Coin Credit form so the received amount is audited.");
      if (amount < 0 && !stockNote.trim()) throw new Error("Add a reason for a negative inventory adjustment.");
      const { error } = await supabase.rpc("admin_adjust_coin_seller_inventory", {
        p_seller_id: selectedSeller, p_delta: amount,
        p_payment_reference: paymentReference.trim() || null, p_note: stockNote.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Seller inventory updated"); setStock("0"); setPaymentReference(""); setStockNote(""); qc.invalidateQueries({ queryKey: ["admin_coin_sellers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const verifyPayment = useMutation({
    mutationFn: async () => {
      const amount = Number(fundingAmount);
      const coins = Number(fundingCoins);
      if (!fundingSeller) throw new Error("Choose a seller.");
      if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) throw new Error("Enter the exact received PKR amount (up to 2 decimals).");
      if (!Number.isSafeInteger(coins) || coins <= 0 || coins > 1000000000) throw new Error("Enter a valid whole coin amount.");
      if (!fundingReference.trim()) throw new Error("Payment transaction/reference number is required.");
      const { error } = await supabase.rpc("admin_verify_coin_seller_payment", {
        p_seller_id: fundingSeller, p_amount_pkr: amount, p_coins: coins,
        p_payment_method: fundingMethod, p_payment_reference: fundingReference.trim(),
        p_note: fundingNote.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded and seller coins credited. Audit entry saved.");
      setFundingAmount(""); setFundingCoins(""); setFundingReference(""); setFundingNote("");
      qc.invalidateQueries({ queryKey: ["admin_coin_sellers"] });
      qc.invalidateQueries({ queryKey: ["admin_coin_seller_transactions"] });
      qc.invalidateQueries({ queryKey: ["admin_coin_seller_funding_audit"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSeller = useMutation({
    mutationFn: async (sellerId: string) => {
      const { error } = await supabase.rpc("admin_delete_coin_seller", { p_seller_id: sellerId });
      if (error) throw error;
    },
    onSuccess: (_data, sellerId) => {
      toast.success("Coin Seller permanently deleted");
      if (selectedSeller === sellerId) setSelectedSeller("");
      qc.invalidateQueries({ queryKey: ["admin_coin_sellers"] });
      qc.invalidateQueries({ queryKey: ["admin_coin_seller_transactions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const transactions = useQuery({
    queryKey: ["admin_coin_seller_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coin_seller_transactions").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      const rows = (data ?? []) as AdminTx[];
      const ids = [...new Set(rows.flatMap((r) => [r.seller_id, r.buyer_id].filter((id): id is string => !!id)))];
      if (!ids.length) return rows;
      const { data: profiles, error: profileError } = await supabase.from("profiles").select("id,username,user_code,avatar").in("id", ids);
      if (profileError) throw profileError;
      const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({ ...r, seller: pMap.get(r.seller_id) ?? null, buyer: r.buyer_id ? pMap.get(r.buyer_id) ?? null : null }));
    },
    staleTime: 15_000,
  });

  const fundingAudit = useQuery({
    queryKey: ["admin_coin_seller_funding_audit"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coin_seller_funding_audit").select("*").order("verified_at", { ascending: false }).limit(250);
      if (error) throw error;
      const rows = (data ?? []) as FundingAudit[];
      const ids = [...new Set(rows.flatMap((r) => [r.seller_id, r.verified_by]))];
      if (!ids.length) return rows;
      const { data: profiles, error: profileError } = await supabase.from("profiles").select("id,username,user_code,avatar").in("id", ids);
      if (profileError) throw profileError;
      const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({ ...r, seller: pMap.get(r.seller_id) ?? null, verifier: pMap.get(r.verified_by) ?? null }));
    },
    staleTime: 15000,
  });

  const activeCount = (sellers.data ?? []).filter((s) => s.is_active && s.is_listed).length;
  const totalStock = (sellers.data ?? []).reduce((n, s) => n + Number(s.inventory?.available_coins ?? 0), 0);
  const totalSold = (sellers.data ?? []).reduce((n, s) => n + Number(s.inventory?.total_sold ?? 0), 0);

  return <div className="space-y-5">
    <AdminPageHeader title="Coin Seller Marketplace" subtitle="Assign sellers, manage public WhatsApp listings, allocate paid inventory and audit coin transfers." />
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {[
        { label: "Total sellers", value: sellers.data?.length ?? 0, icon: Store },
        { label: "Public sellers", value: activeCount, icon: BadgeCheck },
        { label: "Coins in stock", value: totalStock.toLocaleString(), icon: Coins },
        { label: "Coins sold", value: totalSold.toLocaleString(), icon: ShieldCheck },
      ].map((item) => <div key={item.label} className="relative overflow-hidden rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-cyan-950/30 via-card to-slate-950/60 p-4 shadow-lg shadow-cyan-950/10"><div className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full bg-cyan-400/10 blur-2xl" /><item.icon className="mb-3 h-5 w-5 text-cyan-300" /><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 text-2xl font-bold">{item.value}</p></div>)}
    </div>

    <section className="relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-950/20 via-card to-slate-950/40 p-4 shadow-lg shadow-cyan-950/10 sm:p-5">
      <h2 className="mb-1 flex items-center gap-2 text-base font-bold"><Plus className="h-4 w-4 text-primary" /> Assign a seller</h2>
      <p className="mb-4 text-xs text-muted-foreground">Search a registered JALWA user by username or 6-digit user ID. WhatsApp is shown to buyers in the public directory.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div><label className="mb-1 block text-xs text-muted-foreground">Find user</label><input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Username or JALWA ID" className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
          {searchUsers.data && <div className="mt-2 space-y-1">{searchUsers.data.map((p) => <button key={p.id} onClick={() => setSelectedUserId(p.id)} className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left text-sm ${selectedUserId === p.id ? "border-primary bg-primary/10" : "border-border"}`}><div className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 font-bold">{(p.username || "?").slice(0,1).toUpperCase()}</div><span className="min-w-0 flex-1"><span className="block font-semibold">{p.username || "JALWA user"}</span><span className="text-xs text-muted-foreground">ID: {p.user_code || "—"}</span></span>{selectedUserId === p.id && <BadgeCheck className="h-4 w-4 text-primary" />}</button>)}</div>}
        </div>
        <div className="space-y-3">
          <div><label className="mb-1 block text-xs text-muted-foreground">Seller WhatsApp number (with country code)</label><input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="923001234567" inputMode="numeric" className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" /></div>
          <div><label className="mb-1 block text-xs text-muted-foreground">Public display name (optional)</label><input value={publicName} onChange={(e) => setPublicName(e.target.value)} placeholder="Seller display name" className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" /></div>
          <div><label className="mb-1 block text-xs text-muted-foreground">Public note (optional)</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Payment methods / availability" className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" /></div>
          <button disabled={!selectedUserId || assign.isPending} onClick={() => { const p = searchUsers.data?.find((x) => x.id === selectedUserId); if (p) assign.mutate(p); else toast.error("Select a user from search results."); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">{assign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Assign and publish seller</button>
        </div>
      </div>
    </section>

    <section className="relative overflow-hidden rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-950/25 via-card to-slate-950/40 p-4 shadow-lg sm:p-5">
      <h2 className="mb-1 flex items-center gap-2 text-base font-bold"><CreditCard className="h-4 w-4 text-emerald-300" /> Verified payment & coin credit</h2>
      <p className="mb-4 text-xs text-muted-foreground">Verify the seller's actual payment in your bank/payment app, then record the PKR amount, coin amount, method and transaction reference. Saving atomically credits inventory and records who verified it.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div><label className="mb-1 block text-xs text-muted-foreground">Coin seller</label><select value={fundingSeller} onChange={(e) => setFundingSeller(e.target.value)} className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm"><option value="">Select seller</option>{(sellers.data ?? []).map((x) => <option key={x.user_id} value={x.user_id}>{x.profile?.username || x.profile?.user_code || x.user_id.slice(0,8)}</option>)}</select></div>
        <div><label className="mb-1 block text-xs text-muted-foreground">Amount received (PKR)</label><input type="number" min="0.01" step="0.01" value={fundingAmount} onChange={(e) => setFundingAmount(e.target.value)} placeholder="e.g. 5000.00" className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm" /></div>
        <div><label className="mb-1 block text-xs text-muted-foreground">Coins to credit</label><input type="number" min="1" step="1" value={fundingCoins} onChange={(e) => setFundingCoins(e.target.value)} placeholder="e.g. 525000" className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm" /></div>
        <div><label className="mb-1 block text-xs text-muted-foreground">Payment method</label><select value={fundingMethod} onChange={(e) => setFundingMethod(e.target.value)} className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm"><option value="jazzcash">JazzCash</option><option value="easypaisa">Easypaisa</option><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="other">Other</option></select></div>
        <div><label className="mb-1 block text-xs text-muted-foreground">Payment reference / receipt ID (required)</label><input value={fundingReference} onChange={(e) => setFundingReference(e.target.value)} placeholder="Transaction ID" className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm" /></div>
        <div><label className="mb-1 block text-xs text-muted-foreground">Audit note (optional)</label><input value={fundingNote} onChange={(e) => setFundingNote(e.target.value)} placeholder="Agreed rate or other details" className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm" /></div>
      </div>
      {Number(fundingAmount) > 0 && Number(fundingCoins) > 0 && <p className="mt-3 rounded-lg bg-background/60 p-3 text-xs text-muted-foreground">Rate recorded: <strong className="text-foreground">{(Number(fundingCoins) / Number(fundingAmount)).toLocaleString(undefined, { maximumFractionDigits: 6 })} coins per PKR</strong></p>}
      <button disabled={verifyPayment.isPending || !fundingSeller || !fundingAmount || !fundingCoins || !fundingReference.trim()} onClick={() => { if (window.confirm(`Confirm receipt of PKR ${Number(fundingAmount).toLocaleString()} and credit ${Number(fundingCoins).toLocaleString()} coins?`)) verifyPayment.mutate(); }} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{verifyPayment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />} Confirm verified payment & credit coins</button>
    </section>

    <section className="relative overflow-hidden rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-950/20 via-card to-slate-950/40 p-4 shadow-lg shadow-amber-950/10 sm:p-5">
      <h2 className="mb-3 text-base font-bold">Inventory correction (negative adjustment only)</h2>
      <p className="mb-4 text-xs text-muted-foreground">Use this only to reverse unused inventory with a reason. Positive allocations must use the verified payment workflow above.</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <select value={selectedSeller} onChange={(e) => setSelectedSeller(e.target.value)} className="rounded-xl border border-border bg-input px-3 py-2 text-sm"><option value="">Select seller</option>{(sellers.data ?? []).map((s) => <option key={s.user_id} value={s.user_id}>{s.profile?.username || s.profile?.user_code || s.user_id.slice(0,8)}</option>)}</select>
        <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="+ coins / - adjustment" className="rounded-xl border border-border bg-input px-3 py-2 text-sm" />
        <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Payment reference (optional)" className="rounded-xl border border-border bg-input px-3 py-2 text-sm" />
        <input value={stockNote} onChange={(e) => setStockNote(e.target.value)} placeholder="Admin note (optional)" className="rounded-xl border border-border bg-input px-3 py-2 text-sm" />
      </div>
      <button disabled={adjustStock.isPending || !selectedSeller} onClick={() => adjustStock.mutate()} className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">{adjustStock.isPending ? "Saving…" : "Save inventory adjustment"}</button>
    </section>

    <section className="rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-cyan-950/10 via-card to-slate-950/30 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-bold">Seller directory and controls</h2><div className="relative max-w-xs flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search listed sellers" className="w-full rounded-xl border border-border bg-input py-2 pl-9 pr-3 text-sm" /></div></div>
      {sellers.isLoading ? <div className="grid place-items-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : sellers.isError ? <p className="py-6 text-sm text-destructive">Could not load sellers. Check migration and admin permissions.</p> : <div className="space-y-2">{(sellers.data ?? []).filter((s) => `${s.profile?.username ?? ""} ${s.profile?.user_code ?? ""} ${s.whatsapp_number}`.toLowerCase().includes(search.toLowerCase())).map((s) => <div key={s.user_id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 font-bold">{(s.profile?.username || "?").slice(0,1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="font-bold">{s.public_name || s.profile?.username || "Seller"} <span className="text-xs font-normal text-muted-foreground">ID {s.profile?.user_code || "—"}</span></p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MessageCircle className="h-3 w-3" /> +{s.whatsapp_number}</p><p className="mt-1 text-xs text-muted-foreground">Available {Number(s.inventory?.available_coins ?? 0).toLocaleString()} · Sold {Number(s.inventory?.total_sold ?? 0).toLocaleString()} · Allocated {Number(s.inventory?.total_allocated ?? 0).toLocaleString()}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => updateSeller.mutate({ seller: s, patch: { is_listed: !s.is_listed } })} className="rounded-lg border border-border px-2 py-1 text-xs">{s.is_listed ? "Hide listing" : "Publish listing"}</button><button onClick={() => updateSeller.mutate({ seller: s, patch: { is_active: !s.is_active } })} className={`rounded-lg px-2 py-1 text-xs font-bold ${s.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{s.is_active ? "Active" : "Suspended"}</button><button onClick={() => { const n = window.prompt("WhatsApp number with country code", s.whatsapp_number); if (n === null) return; const digits = n.replace(/\D/g, ""); if (digits.length < 8 || digits.length > 15) { toast.error("Enter 8–15 digits including country code."); return; } updateSeller.mutate({ seller: s, patch: { whatsapp_number: digits } }); }} className="rounded-lg border border-border px-2 py-1 text-xs">Edit WhatsApp</button><button disabled={deleteSeller.isPending} onClick={() => { const confirmed = window.confirm(`PERMANENTLY DELETE ${s.public_name || s.profile?.username || "this seller"}? This removes the seller assignment, available inventory, and this seller's Coin Seller transaction history. The JALWA user account itself will NOT be deleted. This cannot be undone.`); if (confirmed) deleteSeller.mutate(s.user_id); }} className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs font-bold text-red-300 disabled:opacity-50"><Trash2 className="h-3 w-3" /> Delete</button></div></div>{s.public_note && <p className="mt-2 text-xs text-muted-foreground">{s.public_note}</p>}</div>)}</div>}
    </section>
    <section className="rounded-2xl border border-red-400/15 bg-gradient-to-br from-red-950/10 via-card to-slate-950/30 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-bold">Transaction audit trail</h2><span className="text-xs text-muted-foreground">Latest 100 entries</span></div>
      {transactions.isLoading ? <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div> : transactions.isError ? <p className="text-sm text-destructive">Could not load transaction history.</p> : (transactions.data ?? []).length === 0 ? <p className="py-5 text-sm text-muted-foreground">No seller transactions yet.</p> : <div className="space-y-2">{(transactions.data ?? []).map((t) => <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10"><Coins className="h-4 w-4 text-primary" /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{t.kind === "sale" ? `Sale: ${t.seller?.username || t.seller?.user_code || "seller"} → ${t.buyer?.username || t.buyer?.user_code || "buyer"}` : t.kind === "allocation" ? `Inventory allocated to ${t.seller?.username || t.seller?.user_code || "seller"}` : `Inventory adjustment: ${t.seller?.username || t.seller?.user_code || "seller"}`}</p><p className="text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleString()} · {t.payment_reference ? `Ref: ${t.payment_reference} · ` : ""}{t.note || "No note"}</p></div><div className="text-right"><p className="text-sm font-bold">{t.kind === "sale" || t.inventory_delta < 0 ? "−" : "+"}{Number(t.coins).toLocaleString()}</p><p className="text-[10px] text-muted-foreground">seller balance {Number(t.seller_balance_after).toLocaleString()}</p></div></div>)}</div>}
    </section>
    <section className="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-950/15 via-card to-slate-950/30 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-base font-bold"><ClipboardCheck className="h-4 w-4 text-emerald-300" /> Verified seller payment audit</h2><span className="text-xs text-muted-foreground">Latest 250 entries</span></div>
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-3"><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">PKR received (entries shown)</p><p className="mt-1 text-xl font-bold">Rs {(fundingAudit.data ?? []).reduce((n, x) => n + Number(x.amount_pkr), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></div><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Coins credited</p><p className="mt-1 text-xl font-bold">{(fundingAudit.data ?? []).reduce((n, x) => n + Number(x.coins_credited), 0).toLocaleString()}</p></div><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Entries</p><p className="mt-1 text-xl font-bold">{(fundingAudit.data ?? []).length}</p></div></div>
      {fundingAudit.isLoading ? <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div> : fundingAudit.isError ? <p className="text-sm text-destructive">Could not load payment audit. Check migration and admin permissions.</p> : (fundingAudit.data ?? []).length === 0 ? <p className="py-5 text-sm text-muted-foreground">No verified seller payments recorded yet.</p> : <div className="space-y-2">{(fundingAudit.data ?? []).map((x) => <div key={x.id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap items-start gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500/10"><CreditCard className="h-4 w-4 text-emerald-400" /></div><div className="min-w-0 flex-1"><p className="text-sm font-bold">{x.seller?.username || x.seller?.user_code || x.seller_id} · Rs {Number(x.amount_pkr).toLocaleString(undefined, { maximumFractionDigits: 2 })} received</p><p className="mt-1 text-xs text-muted-foreground">{x.payment_method.replace("_", " ")} · Ref: {x.payment_reference}</p><p className="mt-1 text-xs text-muted-foreground">Verified by {x.verifier?.username || x.verifier?.user_code || x.verified_by} · {new Date(x.verified_at).toLocaleString()}</p>{x.note && <p className="mt-1 text-xs text-muted-foreground">Note: {x.note}</p>}</div><div className="text-right"><p className="text-sm font-bold text-emerald-400">+{Number(x.coins_credited).toLocaleString()} coins</p><p className="text-[10px] text-muted-foreground">{Number(x.coins_per_pkr).toLocaleString(undefined, { maximumFractionDigits: 6 })} coins/PKR</p><p className="mt-1 text-[10px] text-muted-foreground">Stock {Number(x.inventory_before).toLocaleString()} → {Number(x.inventory_after).toLocaleString()}</p></div></div></div>)}</div>}
      <p className="mt-3 text-[11px] text-muted-foreground">Totals cover the latest 250 records shown. Payment is recorded as verified by the admin who confirms it; the app does not independently verify bank/JazzCash receipts.</p>
    </section>
    <p className="text-xs text-muted-foreground">Seller coin transfers run through a server-side atomic RPC. Admin inventory adjustments and each seller-to-buyer transfer are recorded in an immutable transaction ledger.</p>
  </div>;
}
