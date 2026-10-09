import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, BadgeCheck, Coins, Copy, ExternalLink, Loader2, MessageCircle, Search, ShieldCheck, Store, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/coin-sellers")({ component: CoinSellerMarketplace });

type PublicSeller = { user_id: string; whatsapp_number: string; public_name: string | null; public_note: string | null; is_active: boolean; is_listed: boolean; profile?: { username: string | null; user_code: string | null; avatar: string | null } | null };
type SellerInventory = { seller_id: string; available_coins: number; total_allocated: number; total_sold: number };
type SellerTransaction = { id: string; seller_id: string; buyer_id: string | null; kind: string; coins: number; inventory_delta: number; seller_balance_after: number; buyer_balance_after: number | null; payment_reference: string | null; note: string | null; created_at: string; buyer?: { username: string | null; user_code: string | null } | null; seller?: { username: string | null; user_code: string | null } | null };

function CoinSellerMarketplace() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [buyerCode, setBuyerCode] = useState("");
  const [amount, setAmount] = useState("1000");
  const [confirmTransfer, setConfirmTransfer] = useState(false);

  const directory = useQuery({
    queryKey: ["coin_seller_public_directory"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coin_sellers").select("user_id,whatsapp_number,public_name,public_note,is_active,is_listed").eq("is_active", true).eq("is_listed", true).order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as PublicSeller[];
      if (!rows.length) return rows;
      const { data: profiles, error: profileError } = await supabase.from("profiles").select("id,username,user_code,avatar").in("id", rows.map((r) => r.user_id));
      if (profileError) throw profileError;
      const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({ ...r, profile: pMap.get(r.user_id) ?? null }));
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

  const history = useQuery({
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
      const { data, error } = await supabase.rpc("coin_seller_transfer", { p_buyer_code: buyerCode.trim(), p_coins: coins });
      if (error) throw error;
      return data as { transaction_id: string; buyer_username: string; buyer_code: string; coins_transferred: number; buyer_balance_after: number; seller_balance_after: number };
    },
    onSuccess: (result) => {
      toast.success(`Transferred ${Number(result.coins_transferred).toLocaleString()} coins to ${result.buyer_username || result.buyer_code}`);
      setBuyerCode(""); setConfirmTransfer(false);
      qc.invalidateQueries({ queryKey: ["my_coin_seller_inventory"] });
      qc.invalidateQueries({ queryKey: ["my_coin_seller_transactions"] });
      qc.invalidateQueries({ queryKey: ["my_wallet"] });
      qc.invalidateQueries({ queryKey: ["coin_seller_public_directory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visibleSellers = (directory.data ?? []).filter((s) => `${s.public_name ?? ""} ${s.profile?.username ?? ""} ${s.profile?.user_code ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const isSeller = !!inventory.data;

  return <AppShell><main className="mx-auto w-full max-w-5xl space-y-5 px-3 pb-24 pt-4 sm:px-5">
    <div className="flex items-center gap-3"><button onClick={() => history.length ? window.history.back() : window.location.assign("/")} className="grid h-10 w-10 place-items-center rounded-xl border border-border"><ArrowLeft className="h-4 w-4" /></button><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">JALWA Marketplace</p><h1 className="text-2xl font-bold">Buy Coins from Sellers</h1><p className="text-sm text-muted-foreground">Choose a seller and contact them directly on WhatsApp.</p></div><Store className="h-7 w-7 text-primary" /></div>

    {isSeller && <section className="glass rounded-2xl border border-primary/20 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">Your available seller inventory</p><p className="mt-1 flex items-center gap-2 text-2xl font-bold"><Coins className="h-5 w-5 text-primary" />{Number(inventory.data?.available_coins ?? 0).toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">Lifetime sold: {Number(inventory.data?.total_sold ?? 0).toLocaleString()}</p></div><BadgeCheck className="h-8 w-8 text-primary" /></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-xs text-muted-foreground">Buyer JALWA ID or username</label><input value={buyerCode} onChange={(e) => { setBuyerCode(e.target.value); setConfirmTransfer(false); }} placeholder="6-digit ID or username" className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm" /></div><div><label className="mb-1 block text-xs text-muted-foreground">Coins to transfer</label><input type="number" min="1" max="1000000" value={amount} onChange={(e) => { setAmount(e.target.value); setConfirmTransfer(false); }} className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm" /></div></div>
      <div className="mt-3 rounded-xl bg-background/70 p-3 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Transfer amount</span><strong>{(Number(amount) || 0).toLocaleString()} coins</strong></div><div className="mt-1 flex justify-between"><span className="text-muted-foreground">Inventory after transfer</span><strong>{(Number(inventory.data?.available_coins ?? 0) - (Number(amount) || 0)).toLocaleString()} coins</strong></div></div>
      <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={confirmTransfer} onChange={(e) => setConfirmTransfer(e.target.checked)} className="mt-0.5" /><span>I have received/verified the buyer's payment and confirm this coin transfer.</span></label>
      <button disabled={transfer.isPending || !confirmTransfer || !buyerCode.trim() || !Number.isSafeInteger(Number(amount)) || Number(amount) < 1 || Number(amount) > Number(inventory.data?.available_coins ?? 0)} onClick={() => transfer.mutate()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{transfer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Confirm and transfer coins</button>
      <p className="mt-2 text-[11px] text-muted-foreground">Transfers are instant and irreversible. Verify the buyer ID and payment before confirming.</p>
    </section>}

    <section className="space-y-3"><div className="flex items-center gap-3"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sellers by name or JALWA ID" className="w-full rounded-xl border border-border bg-input py-2 pl-9 pr-3 text-sm" /></div><span className="shrink-0 text-xs text-muted-foreground">{visibleSellers.length} sellers</span></div>
      {directory.isLoading ? <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : directory.isError ? <div className="glass rounded-xl p-5 text-sm text-destructive">Could not load seller directory. Please try again.</div> : visibleSellers.length === 0 ? <div className="glass rounded-2xl p-8 text-center"><Store className="mx-auto h-10 w-10 text-muted-foreground" /><h2 className="mt-3 font-bold">No sellers available</h2><p className="mt-1 text-sm text-muted-foreground">Please check again later.</p></div> : <div className="grid gap-3 md:grid-cols-2">{visibleSellers.map((s) => { const phone = s.whatsapp_number.replace(/\D/g, ""); const wa = `https://wa.me/${phone}?text=${encodeURIComponent(`Assalam-o-Alaikum, I want to buy JALWA coins. My JALWA ID is ${user?.id ?? ""}.`)}`; return <article key={s.user_id} className="glass rounded-2xl p-4 transition hover:border-primary/40"><div className="flex items-start gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/15">{s.profile?.avatar ? <img src={s.profile.avatar} alt="" className="h-full w-full object-cover" /> : <Store className="h-5 w-5 text-primary" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{s.public_name || s.profile?.username || "JALWA Seller"}</h2><span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400"><BadgeCheck className="mr-1 inline h-3 w-3" />Active</span></div><p className="mt-1 text-xs text-muted-foreground">JALWA ID: {s.profile?.user_code || "—"}</p>{s.public_note && <p className="mt-2 text-xs text-muted-foreground">{s.public_note}</p>}</div></div><a href={wa} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white"><MessageCircle className="h-4 w-4" /> Chat on WhatsApp <ExternalLink className="h-3 w-3" /></a><p className="mt-2 text-[10px] text-muted-foreground">Confirm the price and payment details with the seller before sending money.</p></article>})}</div>}
    </section>

    {history.data && history.data.length > 0 && <section className="glass rounded-2xl p-4"><h2 className="mb-3 flex items-center gap-2 font-bold"><Wallet className="h-4 w-4 text-primary" /> Your coin seller transactions</h2><div className="space-y-2">{history.data.slice(0, 20).map((t) => <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border p-3"><div className={`grid h-9 w-9 place-items-center rounded-full ${t.kind === "sale" ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"}`}><Coins className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{t.kind === "sale" ? `Sold to ${t.buyer?.username || t.buyer?.user_code || "buyer"}` : t.kind === "allocation" ? "Admin inventory allocation" : "Inventory adjustment"}</p><p className="text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p></div><div className="text-right"><p className={`text-sm font-bold ${t.kind === "sale" ? "text-amber-400" : "text-emerald-400"}`}>{t.kind === "sale" ? "−" : "+"}{Number(t.coins).toLocaleString()}</p><p className="text-[10px] text-muted-foreground">coins</p></div></div>)}</div></section>}
    <p className="text-center text-[11px] text-muted-foreground">JALWA does not collect seller payments. Pay only after verifying the seller and their payment details.</p>
  </main></AppShell>;
}
