import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Coins, Copy, Loader2, Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recharge")({
  component: RechargePage,
});

type Pkg = {
  id: string;
  coins: number;
  bonus_coins: number;
  price_pkr: number;
  label: string | null;
  badge: string | null;
};

type PayInfo = {
  jazzcash?: string;
  easypaisa?: string;
  bankName?: string;
  bankAccount?: string;
  bankTitle?: string;
  crypto?: string;
};

type Method = "jazzcash" | "easypaisa" | "bank" | "crypto";

const METHOD_LABEL: Record<Method, string> = {
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  bank: "Bank Transfer",
  crypto: "USDT (TRC20)",
};

function RechargePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [selectedPkg, setSelectedPkg] = useState<Pkg | null>(null);
  const [method, setMethod] = useState<Method>("jazzcash");
  const [senderName, setSenderName] = useState("");
  const [senderAccount, setSenderAccount] = useState("");
  const [txnRef, setTxnRef] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const packages = useQuery({
    queryKey: ["coin_packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coin_packages")
        .select("id,coins,bonus_coins,price_pkr,label,badge")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Pkg[];
    },
  });

  const paymentSetting = useQuery({
    queryKey: ["app_settings", "payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "payments")
        .maybeSingle();
      if (error) throw error;
      return (data?.value ?? {}) as PayInfo;
    },
  });

  const history = useQuery({
    queryKey: ["recharge_history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recharge_requests")
        .select("id,coins_expected,amount_pkr,method,status,created_at,admin_note")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const details = useMemo(() => {
    const p = paymentSetting.data ?? {};
    if (method === "jazzcash") return { line1: "JazzCash", line2: p.jazzcash || "—" };
    if (method === "easypaisa") return { line1: "Easypaisa", line2: p.easypaisa || "—" };
    if (method === "crypto") return { line1: "USDT (TRC20)", line2: p.crypto || "—" };
    return {
      line1: p.bankName || "Bank",
      line2: p.bankAccount || "—",
      line3: p.bankTitle ? `Title: ${p.bankTitle}` : undefined,
    };
  }, [method, paymentSetting.data]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in");
      if (!selectedPkg) throw new Error("Choose a package");
      if (!file) throw new Error("Upload payment proof screenshot");

      setUploading(true);
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const up = await supabase.storage.from("recharge-proofs").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      setUploading(false);
      if (up.error) throw up.error;

      const { data: pub } = supabase.storage.from("recharge-proofs").getPublicUrl(path);

      const { error } = await supabase.from("recharge_requests").insert({
        user_id: user.id,
        package_id: selectedPkg.id,
        method,
        amount_pkr: selectedPkg.price_pkr,
        coins_expected: selectedPkg.coins + selectedPkg.bonus_coins,
        proof_url: pub.publicUrl,
        sender_name: senderName || null,
        sender_account: senderAccount || null,
        txn_reference: txnRef || null,
        note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recharge submitted! Admin will approve shortly.");
      setSelectedPkg(null);
      setFile(null);
      setSenderName("");
      setSenderAccount("");
      setTxnRef("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["recharge_history"] });
    },
    onError: (e: Error) => {
      setUploading(false);
      toast.error(e.message);
    },
  });

  const copy = (v: string) => {
    if (!v || v === "—") return;
    navigator.clipboard.writeText(v);
    toast.success("Copied");
  };

  return (
    <>
      <AppShell
        title="Recharge Coins"
        subtitle="Manual deposit + proof upload"
        right={
          <button
            onClick={() => navigate({ to: "/wallet" })}
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-full bg-card/60"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        }
      >
        <div className="space-y-5 px-4 pt-4 pb-8">
          {/* Packages */}
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              1 · Choose a package
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {packages.data?.map((p) => {
                const active = selectedPkg?.id === p.id;
                const total = p.coins + p.bonus_coins;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPkg(p)}
                    className={`relative rounded-2xl border p-3 text-left transition ${
                      active
                        ? "border-[color:var(--primary)] bg-primary/10 ring-2 ring-[color:var(--primary)]/40"
                        : "border-border bg-card/60"
                    }`}
                  >
                    {p.badge && (
                      <span className="absolute -top-2 left-3 rounded-full bg-[color:var(--gold)] px-2 py-0.5 text-[9px] font-black uppercase text-black">
                        {p.badge}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Coins className="h-4 w-4 text-[color:var(--gold)]" />
                      <span className="text-lg font-black">{total.toLocaleString()}</span>
                    </div>
                    {p.bonus_coins > 0 && (
                      <p className="text-[10px] text-[color:var(--gold)]">
                        +{p.bonus_coins.toLocaleString()} bonus
                      </p>
                    )}
                    <p className="mt-2 text-sm font-bold">Rs {p.price_pkr.toLocaleString()}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Method */}
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              2 · Payment method
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(METHOD_LABEL) as Method[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                    method === m
                      ? "border-[color:var(--primary)] bg-primary/10 text-primary-foreground"
                      : "border-border bg-card/60"
                  }`}
                >
                  {METHOD_LABEL[m]}
                </button>
              ))}
            </div>

            {/* Deposit target */}
            <div className="mt-3 rounded-2xl bg-gradient-to-br from-[color:var(--gold)]/15 to-transparent p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Send payment to
              </p>
              <p className="mt-1 text-sm font-bold">{details.line1}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="truncate text-lg font-black tracking-wide">{details.line2}</p>
                <button
                  onClick={() => copy(details.line2)}
                  className="rounded-full bg-card/70 p-2"
                  aria-label="Copy"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              {details.line3 && (
                <p className="mt-1 text-xs text-muted-foreground">{details.line3}</p>
              )}
              {selectedPkg && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Amount to send:{" "}
                  <span className="font-bold text-[color:var(--gold)]">
                    Rs {selectedPkg.price_pkr.toLocaleString()}
                  </span>
                </p>
              )}
            </div>
          </section>

          {/* Proof form */}
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              3 · Payment proof
            </h2>
            <div className="space-y-2.5">
              <input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Your name (as sender)"
                className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none"
              />
              <input
                value={senderAccount}
                onChange={(e) => setSenderAccount(e.target.value)}
                placeholder="Your sending account / number"
                className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none"
              />
              <input
                value={txnRef}
                onChange={(e) => setTxnRef(e.target.value)}
                placeholder="Transaction reference / TrxID"
                className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none"
              />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                rows={2}
                className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none"
              />

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-border bg-card/40 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/20">
                  {file ? (
                    <CheckCircle2 className="h-5 w-5 text-[color:var(--gold)]" />
                  ) : (
                    <Upload className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {file ? file.name : "Upload payment screenshot"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    JPG / PNG · max 5MB
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f && f.size > 5 * 1024 * 1024) {
                      toast.error("File too large (max 5MB)");
                      return;
                    }
                    setFile(f);
                  }}
                />
              </label>
            </div>
          </section>

          <button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || uploading || !selectedPkg || !file}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-50"
          >
            {(submit.isPending || uploading) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Submit for approval
          </button>

          {/* History */}
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Recent recharges
            </h2>
            {history.data?.length ? (
              <div className="space-y-2">
                {history.data.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between rounded-xl bg-card/60 p-3 text-sm"
                  >
                    <div>
                      <p className="font-bold">
                        {h.coins_expected.toLocaleString()} coins
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Rs {Number(h.amount_pkr).toLocaleString()} · {h.method}
                      </p>
                      {h.admin_note && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          Note: {h.admin_note}
                        </p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                        h.status === "approved"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : h.status === "rejected"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-[color:var(--gold)]/20 text-[color:var(--gold)]"
                      }`}
                    >
                      {h.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-xs text-muted-foreground">No recharges yet</p>
            )}
          </section>

          <div className="text-center">
            <Link to="/wallet" className="text-xs text-muted-foreground underline">
              Back to wallet
            </Link>
          </div>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
