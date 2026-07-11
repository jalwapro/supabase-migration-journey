import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft, Coins, Loader2, CheckCircle2, Smartphone, Building2,
  CreditCard, Wallet, Sparkles, Crown, Gem, Flame,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recharge")({
  component: RechargePage,
});

type Tier = "starter" | "popular" | "vip" | "whale";
type Method = "jazzcash" | "easypaisa" | "bank" | "card" | "paypal";

type Pkg = {
  id: string;
  coins: number;
  bonus_coins: number;
  price_pkr: number;
  label: string | null;
  badge: string | null;
  tier: Tier;
};

type InitiateResp = {
  order_id: string;
  otp_code: string;
  expires_at: string;
  amount_pkr: number;
  coins_total: number;
};

type Step = "select" | "details" | "otp" | "success";

const TIERS: { key: Tier; label: string; icon: typeof Sparkles; color: string }[] = [
  { key: "starter", label: "Starter", icon: Sparkles, color: "from-sky-400 to-cyan-500" },
  { key: "popular", label: "Popular", icon: Flame, color: "from-pink-500 to-rose-500" },
  { key: "vip",     label: "VIP",     icon: Crown, color: "from-amber-400 to-yellow-500" },
  { key: "whale",   label: "Whale",   icon: Gem,   color: "from-fuchsia-500 to-violet-600" },
];

const METHODS: {
  key: Method; label: string; icon: typeof Smartphone; sub: string; placeholder: string;
}[] = [
  { key: "jazzcash",  label: "JazzCash",  icon: Smartphone, sub: "Mobile Wallet",   placeholder: "03XX-XXXXXXX" },
  { key: "easypaisa", label: "EasyPaisa", icon: Smartphone, sub: "Mobile Wallet",   placeholder: "03XX-XXXXXXX" },
  { key: "bank",      label: "Bank",      icon: Building2,  sub: "Direct Transfer", placeholder: "Account / IBAN" },
  { key: "card",      label: "Card",      icon: CreditCard, sub: "Debit / Credit",  placeholder: "Card number" },
  { key: "paypal",    label: "PayPal",    icon: Wallet,     sub: "International",   placeholder: "PayPal email" },
];

function RechargePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [tier, setTier] = useState<Tier>("popular");
  const [selectedPkg, setSelectedPkg] = useState<Pkg | null>(null);
  const [method, setMethod] = useState<Method>("jazzcash");
  const [accountRef, setAccountRef] = useState("");
  const [step, setStep] = useState<Step>("select");
  const [order, setOrder] = useState<InitiateResp | null>(null);
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [creditedCoins, setCreditedCoins] = useState(0);

  const packages = useQuery({
    queryKey: ["coin_packages_v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coin_packages")
        .select("id,coins,bonus_coins,price_pkr,label,badge,tier")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Pkg[];
    },
  });

  const tierPackages = useMemo(
    () => (packages.data ?? []).filter((p) => p.tier === tier),
    [packages.data, tier],
  );

  // OTP countdown
  useEffect(() => {
    if (step !== "otp" || !order) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(order.expires_at).getTime() - Date.now()) / 1000));
      setCountdown(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [step, order]);

  const initiate = useMutation({
    mutationFn: async () => {
      if (!selectedPkg) throw new Error("Choose a package");
      if (!accountRef || accountRef.trim().length < 4) throw new Error("Enter your account details");
      const { data, error } = await supabase.rpc("recharge_initiate", {
        _package_id: selectedPkg.id,
        _method: method,
        _account_ref: accountRef.trim(),
      });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as InitiateResp;
      if (!row) throw new Error("Failed to create order");
      return row;
    },
    onSuccess: (row) => {
      setOrder(row);
      setOtp("");
      setStep("otp");
      toast.success("OTP sent to your account");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verify = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error("No order");
      if (otp.length !== 6) throw new Error("Enter 6-digit OTP");
      const { data, error } = await supabase.rpc("recharge_verify_otp", {
        _order_id: order.order_id,
        _otp: otp,
      });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as {
        success: boolean; coins_credited: number; new_balance: number; message: string;
      };
      if (!row?.success) throw new Error(row?.message || "Verification failed");
      return row;
    },
    onSuccess: (row) => {
      setCreditedCoins(row.coins_credited);
      setStep("success");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["wallet_transactions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = () => {
    setSelectedPkg(null);
    setAccountRef("");
    setOtp("");
    setOrder(null);
    setStep("select");
  };

  const activeMethod = METHODS.find((m) => m.key === method)!;

  return (
    <>
      <AppShell
        title="Recharge Coins"
        subtitle={step === "otp" ? "Enter OTP to confirm" : "Instant top-up"}
        right={
          <button
            onClick={() => (step === "select" ? navigate({ to: "/wallet" }) : reset())}
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-full bg-card/60"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        }
      >
        <div className="space-y-5 px-4 pt-4 pb-8">
          {/* STEP: package select */}
          {step === "select" && (
            <>
              {/* Tier tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
                {TIERS.map((t) => {
                  const Icon = t.icon;
                  const active = tier === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => { setTier(t.key); setSelectedPkg(null); }}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                        active
                          ? `bg-gradient-to-r ${t.color} text-white shadow-lg`
                          : "bg-card/60 text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Packages */}
              {packages.isLoading && (
                <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {tierPackages.map((p) => {
                  const active = selectedPkg?.id === p.id;
                  const total = p.coins + p.bonus_coins;
                  const bonusPct = p.coins > 0 ? Math.round((p.bonus_coins / p.coins) * 100) : 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPkg(p)}
                      className={`relative overflow-hidden rounded-2xl border p-4 text-left transition ${
                        active
                          ? "border-[color:var(--gold)] bg-gradient-to-br from-[color:var(--gold)]/20 to-primary/10 ring-2 ring-[color:var(--gold)]/50"
                          : "border-border bg-card/60"
                      }`}
                    >
                      {p.badge && (
                        <span className="absolute -top-1 -right-1 rounded-bl-xl rounded-tr-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-2 py-0.5 text-[9px] font-black uppercase text-white">
                          {p.badge}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Coins className="h-4 w-4 text-[color:var(--gold)]" />
                        <span className="text-lg font-black">{total.toLocaleString()}</span>
                      </div>
                      {p.bonus_coins > 0 && (
                        <p className="text-[10px] font-bold text-emerald-400">
                          +{bonusPct}% BONUS
                        </p>
                      )}
                      <p className="mt-2 text-sm font-black text-[color:var(--gold)]">
                        Rs {p.price_pkr.toLocaleString()}
                      </p>
                      {p.label && <p className="text-[10px] text-muted-foreground">{p.label}</p>}
                    </button>
                  );
                })}
              </div>

              <button
                disabled={!selectedPkg}
                onClick={() => setStep("details")}
                className="w-full rounded-full bg-gradient-to-r from-pink-500 to-violet-600 py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-lg disabled:opacity-40"
              >
                Continue
              </button>
            </>
          )}

          {/* STEP: method + account details */}
          {step === "details" && selectedPkg && (
            <>
              {/* Summary card */}
              <div className="rounded-2xl bg-gradient-to-br from-[color:var(--gold)]/20 to-primary/10 p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">You will receive</p>
                <div className="mt-1 flex items-center gap-2">
                  <Coins className="h-6 w-6 text-[color:var(--gold)]" />
                  <span className="text-2xl font-black">
                    {(selectedPkg.coins + selectedPkg.bonus_coins).toLocaleString()}
                  </span>
                  {selectedPkg.bonus_coins > 0 && (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-400">
                      +{selectedPkg.bonus_coins.toLocaleString()} bonus
                    </span>
                  )}
                </div>
                <p className="mt-2 text-lg font-black text-[color:var(--gold)]">
                  Rs {selectedPkg.price_pkr.toLocaleString()}
                </p>
              </div>

              {/* Method picker */}
              <section>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Payment method
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {METHODS.map((m) => {
                    const Icon = m.icon;
                    const active = method === m.key;
                    return (
                      <button
                        key={m.key}
                        onClick={() => setMethod(m.key)}
                        className={`flex items-center gap-2 rounded-xl border p-3 text-left transition ${
                          active
                            ? "border-[color:var(--primary)] bg-primary/10"
                            : "border-border bg-card/60"
                        }`}
                      >
                        <div className={`grid h-9 w-9 place-items-center rounded-lg ${
                          active ? "bg-primary/30" : "bg-card"
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{m.label}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{m.sub}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Account input */}
              <section>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {activeMethod.label} account
                </h2>
                <input
                  value={accountRef}
                  onChange={(e) => setAccountRef(e.target.value)}
                  placeholder={activeMethod.placeholder}
                  className="w-full rounded-xl border border-border bg-input px-4 py-3 text-base font-semibold outline-none focus:border-primary"
                />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  OTP will be sent to this account by {activeMethod.label}. Enter it on next screen to confirm.
                </p>
              </section>

              <button
                disabled={initiate.isPending || !accountRef}
                onClick={() => initiate.mutate()}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-violet-600 py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-lg disabled:opacity-40"
              >
                {initiate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Send OTP · Rs {selectedPkg.price_pkr.toLocaleString()}
              </button>
            </>
          )}

          {/* STEP: OTP */}
          {step === "otp" && order && (
            <>
              <div className="rounded-2xl bg-card/60 p-5 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/20">
                  <Smartphone className="h-7 w-7 text-primary" />
                </div>
                <p className="mt-3 text-sm font-bold">Verify {activeMethod.label} payment</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  6-digit OTP sent to <span className="font-bold text-foreground">{accountRef}</span>
                </p>
                <p className="mt-1 text-xs">
                  Amount: <span className="font-black text-[color:var(--gold)]">Rs {Number(order.amount_pkr).toLocaleString()}</span>
                </p>
              </div>

              {/* Demo OTP hint */}
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Demo Mode</p>
                <p className="mt-1 text-xs">Your OTP is:</p>
                <p className="mt-0.5 text-2xl font-black tracking-[0.4em] text-amber-300">{order.otp_code}</p>
              </div>

              <input
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                className="w-full rounded-xl border border-border bg-input px-4 py-4 text-center text-3xl font-black tracking-[0.5em] outline-none focus:border-primary"
              />

              <p className="text-center text-xs text-muted-foreground">
                {countdown > 0
                  ? `Expires in ${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, "0")}`
                  : "OTP expired — go back and retry"}
              </p>

              <button
                disabled={verify.isPending || otp.length !== 6 || countdown === 0}
                onClick={() => verify.mutate()}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-lg disabled:opacity-40"
              >
                {verify.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm & Credit Coins
              </button>

              <button
                onClick={reset}
                className="w-full text-center text-xs text-muted-foreground underline"
              >
                Cancel & start over
              </button>
            </>
          )}

          {/* STEP: success */}
          {step === "success" && (
            <div className="space-y-4 py-6 text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500/20">
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              </div>
              <div>
                <p className="text-lg font-black">Payment Confirmed!</p>
                <p className="mt-1 text-xs text-muted-foreground">Your coins are now in your wallet</p>
              </div>
              <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--gold)]/30 to-[color:var(--gold)]/10 px-6 py-3">
                <Coins className="h-6 w-6 text-[color:var(--gold)]" />
                <span className="text-2xl font-black">+{creditedCoins.toLocaleString()}</span>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={reset}
                  className="flex-1 rounded-full border border-border bg-card/60 py-3 text-xs font-black uppercase tracking-widest"
                >
                  Recharge Again
                </button>
                <button
                  onClick={() => navigate({ to: "/wallet" })}
                  className="flex-1 rounded-full bg-gradient-to-r from-pink-500 to-violet-600 py-3 text-xs font-black uppercase tracking-widest text-white"
                >
                  Go to Wallet
                </button>
              </div>
            </div>
          )}
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
