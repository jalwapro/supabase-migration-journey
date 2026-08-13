import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { ArrowLeft, CheckCircle2, Copy, Image as ImageIcon, Loader2, Smartphone, Upload, WalletCards } from "lucide-react";
import { toast } from "sonner";
import jalwaCoin from "@/assets/jalwa-coin.png.asset.json";

export const Route = createFileRoute("/_authenticated/recharge")({ component: RechargePage });

type Method = "easypaisa" | "jazzcash";
type Tier = "starter" | "popular" | "vip" | "whale";
type Pkg = { id: string; coins: number; bonus_coins: number; price_pkr: number; label: string | null; badge: string | null; tier: Tier };

const tiers: { key: Tier; label: string }[] = [
  { key: "starter", label: "Starter" }, { key: "popular", label: "Popular" },
  { key: "vip", label: "VIP" }, { key: "whale", label: "Whale" },
];
const coinSrc = jalwaCoin.url;
const Coin = ({ className = "h-5 w-5" }: { className?: string }) => <img src={coinSrc} alt="Jalwa coin" className={className} />;

function RechargePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tier, setTier] = useState<Tier>("popular");
  const [selectedPkg, setSelectedPkg] = useState<Pkg | null>(null);
  const [method, setMethod] = useState<Method>("easypaisa");
  const [senderAccount, setSenderAccount] = useState("");
  const [txnReference, setTxnReference] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const accounts = useQuery({
    queryKey: ["app_kv", "payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_kv").select("value").eq("key", "payments").maybeSingle();
      if (error) throw error;
      return (data?.value ?? {}) as Record<string, string>;
    },
  });

  const packages = useQuery({
    queryKey: ["coin_packages_v2"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coin_packages").select("id,coins,bonus_coins,price_pkr,label,badge,tier").eq("active", true).order("sort_order");
      if (error) throw error;
      return (data ?? []) as Pkg[];
    },
  });
  const tierPackages = useMemo(() => (packages.data ?? []).filter(p => p.tier === tier), [packages.data, tier]);
  const qrUrl = method === "easypaisa" ? accounts.data?.easypaisaQrUrl : accounts.data?.jazzcashQrUrl;
  const tillId = method === "easypaisa" ? accounts.data?.easypaisaTillId : accounts.data?.jazzcashTillId;
  const title = method === "easypaisa" ? accounts.data?.easypaisaTitle : accounts.data?.jazzcashTitle;

  const submit = useMutation({
    mutationFn: async () => {
      if (!selectedPkg) throw new Error("Choose a package");
      if (!senderAccount.trim()) throw new Error("Enter your sending account number");
      if (!txnReference.trim()) throw new Error("Enter the transaction ID");
      if (!proofFile) throw new Error("Upload your payment screenshot");
      if (!qrUrl) throw new Error(`${method === "easypaisa" ? "Easypaisa" : "JazzCash"} QR is not configured by admin yet`);

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Please login again");
      const safeName = proofFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${uid}/${crypto.randomUUID()}-${safeName}`;
      const upload = await supabase.storage.from("recharge-proofs").upload(path, proofFile, { upsert: false, contentType: proofFile.type });
      if (upload.error) throw upload.error;
      const { data: publicData } = supabase.storage.from("recharge-proofs").getPublicUrl(path);
      const { data, error } = await supabase.rpc("create_manual_recharge", {
        _package_id: selectedPkg.id,
        _method: method,
        _sender_account: senderAccount.trim(),
        _txn_reference: txnReference.trim(),
        _proof_url: publicData.publicUrl,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Payment submitted for verification");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = () => {
    setSelectedPkg(null); setSenderAccount(""); setTxnReference(""); setProofFile(null); setSubmitted(false);
  };

  return <>
    <AppShell title="Recharge Coins" subtitle="Manual QR payment">
      <div className="space-y-5 px-4 pt-4 pb-8">
        {submitted ? <Success onReset={reset} onWallet={() => navigate({ to: "/wallet" })} /> : <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tiers.map(t => <button key={t.key} onClick={() => { setTier(t.key); setSelectedPkg(null); }} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ${tier === t.key ? "bg-primary text-primary-foreground" : "bg-card/60 text-muted-foreground"}`}>{t.label}</button>)}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {tierPackages.map(p => {
              const active = selectedPkg?.id === p.id;
              return <button key={p.id} onClick={() => setSelectedPkg(p)} className={`relative rounded-2xl border p-4 text-left ${active ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border bg-card/60"}`}>
                {p.badge && <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-black text-primary-foreground">{p.badge}</span>}
                <div className="flex items-center gap-2"><Coin className="h-5 w-5" /><b className="text-lg">{(p.coins + p.bonus_coins).toLocaleString()}</b></div>
                {p.bonus_coins > 0 && <p className="text-[10px] font-bold text-emerald-400">+{p.bonus_coins.toLocaleString()} bonus</p>}
                <p className="mt-2 text-sm font-black">Rs {Number(p.price_pkr).toLocaleString()}</p>
                {p.label && <p className="text-[10px] text-muted-foreground">{p.label}</p>}
              </button>;
            })}
          </div>

          {selectedPkg && <>
            <div className="rounded-2xl bg-card/60 p-4"><p className="text-xs text-muted-foreground">You pay</p><p className="text-2xl font-black">Rs {Number(selectedPkg.price_pkr).toLocaleString()}</p><p className="text-sm font-bold text-emerald-400">Receive {(selectedPkg.coins + selectedPkg.bonus_coins).toLocaleString()} coins</p></div>

            <div className="grid grid-cols-2 gap-2">
              {(["easypaisa", "jazzcash"] as Method[]).map(m => <button key={m} onClick={() => setMethod(m)} className={`rounded-xl border p-3 text-sm font-black capitalize ${method === m ? "border-primary bg-primary/10" : "border-border bg-card/60"}`}><Smartphone className="mx-auto mb-1 h-5 w-5" />{m}</button>)}
            </div>

            <div className="rounded-2xl border border-border bg-card/60 p-4">
              <div className="mb-3 flex items-center gap-2"><WalletCards className="h-5 w-5" /><b>{method === "easypaisa" ? "Easypaisa" : "JazzCash"} payment</b></div>
              {qrUrl ? <img src={qrUrl} alt={`${method} payment QR`} className="mx-auto mb-4 max-h-72 w-full rounded-xl bg-white object-contain p-3" /> : <div className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground"><ImageIcon className="mx-auto mb-2 h-7 w-7" />Admin has not configured the {method} QR yet.</div>}
              {tillId && <Info label="Till / Merchant ID" value={tillId} />}
              {title && <Info label="Account title" value={title} />}
              <p className="mt-3 text-xs text-muted-foreground">Pay the exact amount <b className="text-foreground">Rs {Number(selectedPkg.price_pkr).toLocaleString()}</b>, then submit your transaction details below.</p>
            </div>

            <input value={senderAccount} onChange={e => setSenderAccount(e.target.value)} placeholder="Your Easypaisa/JazzCash number" className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm font-semibold" />
            <input value={txnReference} onChange={e => setTxnReference(e.target.value)} placeholder="Transaction ID / TID" className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm font-semibold" />
            <label className="block rounded-xl border border-dashed border-border bg-card/40 p-4 cursor-pointer"><div className="flex items-center gap-2 text-sm font-bold"><Upload className="h-4 w-4" />{proofFile ? proofFile.name : "Upload payment screenshot"}</div><input type="file" accept="image/*" className="hidden" onChange={e => setProofFile(e.target.files?.[0] ?? null)} /></label>
            <p className="text-[11px] text-muted-foreground">Your payment stays pending until an admin verifies it. Coins are not credited automatically.</p>
            <button disabled={submit.isPending || !proofFile || !senderAccount || !txnReference} onClick={() => submit.mutate()} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-black text-primary-foreground disabled:opacity-40">{submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Submit Payment</button>
          </>}
        </>}
      </div>
    </AppShell>
    <BottomNav />
  </>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-border bg-input/60 px-3 py-2"><div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="text-xs font-bold">{value}</p></div><button type="button" onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied"); }} className="rounded-lg bg-card p-2"><Copy className="h-3.5 w-3.5" /></button></div>;
}

function Success({ onReset, onWallet }: { onReset: () => void; onWallet: () => void }) {
  return <div className="space-y-5 py-8 text-center"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500/20"><CheckCircle2 className="h-10 w-10 text-emerald-400" /></div><div><p className="text-xl font-black">Payment Submitted</p><p className="mt-2 text-sm text-muted-foreground">Your payment is pending admin verification. Coins will be added only after approval.</p></div><div className="flex gap-2"><button onClick={onReset} className="flex-1 rounded-full border border-border py-3 text-xs font-black">Recharge Again</button><button onClick={onWallet} className="flex-1 rounded-full bg-primary py-3 text-xs font-black text-primary-foreground">Wallet</button></div></div>;
}
