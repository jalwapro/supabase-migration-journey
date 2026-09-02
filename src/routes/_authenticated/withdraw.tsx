import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Coins, Sparkles, ArrowRightLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/withdraw")({ component: Page });

function Page() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [diamonds, setDiamonds] = useState(1000);
  const [method, setMethod] = useState<"jazzcash" | "easypaisa" | "bank" | "manual">("jazzcash");
  const [accNum, setAccNum] = useState("");
  const [accName, setAccName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Exchange state
  const [exchangeAmount, setExchangeAmount] = useState(1000);
  const [exchanging, setExchanging] = useState(false);

  // Server-driven rate + limits. Never hard-code payout math client-side.
  const { data: settings } = useQuery({
    queryKey: ["withdrawal_settings"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_withdrawal_settings");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        rate: Number(row?.diamond_price_pkr ?? 0.5),
        max: Number(row?.max_withdrawal_diamonds ?? 10_000_000),
        min: Number(row?.min_withdrawal_diamonds ?? 100),
      };
    },
  });

  // Fetch Red Diamonds balance / task stats for this user
  const { data: hostStats } = useQuery({
    queryKey: ["host_red_diamonds", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("host_popularity_get_v2", { _host_id: user!.id });
      if (error) return { red_diamonds: 0, pkr_val: 500 };
      const row = Array.isArray(data) ? data[0] : data;
      return {
        red_diamonds: Number(row?.red_diamonds ?? 0),
        pkr_val: Number(row?.red_diamonds_pkr_value ?? 500),
      };
    },
  });

  const { data: history } = useQuery({
    queryKey: ["withdrawals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawal_requests")
        .select("id, diamonds, amount_pkr, method, status, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const balance = profile?.diamonds ?? 0;
  const rate = settings?.rate ?? 0.5;
  const minD = settings?.min ?? 100;
  const maxD = settings?.max ?? 10_000_000;
  const amount = Math.max(0, diamonds * rate);
  const hasPending = (history ?? []).some((h) => h.status === "pending");

  const redDiamondsCount = hostStats?.red_diamonds ?? 0;
  const redDiamondsPkr = redDiamondsCount > 0 ? (redDiamondsCount / 100000) * 500 : 0;

  async function submit() {
    if (!user || submitting) return;
    if (diamonds < minD) return toast.error(`Minimum ${minD} points`);
    if (diamonds > maxD) return toast.error(`Maximum ${maxD.toLocaleString()} points per request`);
    if (diamonds > balance) return toast.error("Not enough points");
    if (hasPending) return toast.error("You already have a pending withdrawal");
    if (!accNum.trim() || !accName.trim()) return toast.error("Fill account details");

    // Validation for JazzCash / EasyPaisa (Must be 11 digits starting with 03)
    if ((method === "jazzcash" || method === "easypaisa") && !/^03\d{9}$/.test(accNum.trim())) {
      return toast.error("Enter a valid 11-digit mobile number (e.g. 03XXXXXXXXX)");
    }

    setSubmitting(true);
    const { error } = await supabase.rpc("request_withdrawal", {
      _diamonds: diamonds,
      _method: method,
      _account_number: accNum.trim(),
      _account_name: accName.trim(),
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Withdrawal requested");
    setAccNum("");
    setAccName("");
    qc.invalidateQueries({ queryKey: ["withdrawals"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function handleExchange() {
    if (!user || exchanging) return;
    if (exchangeAmount <= 0) return toast.error("Enter a valid amount");
    if (exchangeAmount > redDiamondsCount) return toast.error("Not enough Red Diamonds");

    setExchanging(true);
    const { data, error } = await supabase.rpc("exchange_red_diamonds_for_coins", {
      _red_diamonds_to_exchange: exchangeAmount,
    });
    setExchanging(false);

    if (error) return toast.error(error.message);
    toast.success(`Successfully exchanged for ${(exchangeAmount * 10).toLocaleString()} Coins!`);
    qc.invalidateQueries({ queryKey: ["host_red_diamonds"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <>
      <AppShell title="Withdraw Points">
        <div className="space-y-4 px-4 pt-4 pb-20">
          
          {/* Available Balance Card */}
          <div className="glass rounded-3xl p-4 text-center border border-white/10">
            <p className="text-xs text-muted-foreground">Available balance</p>
            <p className="mt-1 text-3xl font-black text-[color:var(--gold)]">{balance.toLocaleString()} pts</p>
            <p className="text-[10px] text-muted-foreground mt-1">≈ Rs. {(balance * rate).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          </div>

          {/* Red Diamonds & Exchange Card */}
          <div className="rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-500/15 to-purple-500/15 p-4 relative overflow-hidden space-y-3">
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <Sparkles className="w-24 h-24 text-red-400" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-red-400" />
                <h3 className="text-xs font-bold uppercase tracking-wide text-red-300">Daily Task Red Diamonds</h3>
              </div>
              <span className="text-[9px] text-muted-foreground bg-black/40 px-2 py-0.5 rounded-full">PKR {redDiamondsPkr.toLocaleString()} Value</span>
            </div>

            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-2xl font-black text-white">{redDiamondsCount.toLocaleString()}</p>
                <p className="text-[10px] text-white/60">Earned via 6h Live & 1M Room Gifting</p>
              </div>
            </div>

            {/* Exchange Section */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-white/80 font-medium">
                <span>Exchange for Gifting Coins (Rate: 1:10)</span>
                <span className="text-emerald-400 font-bold">{(exchangeAmount * 10).toLocaleString()} Coins</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={redDiamondsCount}
                  value={exchangeAmount}
                  onChange={(e) => setExchangeAmount(Number(e.target.value))}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-red-400"
                  placeholder="Amount to exchange"
                />
                <button
                  onClick={handleExchange}
                  disabled={exchanging || redDiamondsCount <= 0}
                  className="flex items-center gap-1 rounded-xl bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50 transition-all shrink-0"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  {exchanging ? "Exchanging…" : "Exchange"}
                </button>
              </div>
            </div>
          </div>

          {/* Withdrawal Form */}
          <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-4">
            <Field label="Points to withdraw">
              <input
                type="number"
                min={minD}
                max={maxD}
                value={diamonds}
                onChange={(e) => setDiamonds(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm outline-none"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                ≈ Rs. {amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                {" "}· rate 1 pt = Rs. {rate}
              </p>
            </Field>
            <Field label="Method">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm outline-none"
              >
                <option value="jazzcash">JazzCash</option>
                <option value="easypaisa">EasyPaisa</option>
                <option value="bank">Bank Transfer</option>
                <option value="manual">Manual / Other</option>
              </select>
            </Field>
            <Field label={method === "jazzcash" || method === "easypaisa" ? "Mobile Number (03XXXXXXXXX)" : "Account number / IBAN"}>
              <input
                placeholder={method === "jazzcash" || method === "easypaisa" ? "03001234567" : "Enter account number"}
                value={accNum}
                onChange={(e) => setAccNum(e.target.value)}
                className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm outline-none"
              />
            </Field>
            <Field label="Account holder name">
              <input
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm outline-none"
              />
            </Field>
            <button
              onClick={submit}
              disabled={submitting || hasPending}
              className="w-full rounded-xl bg-[color:var(--gold)] py-3 text-sm font-black text-black disabled:opacity-50"
            >
              {submitting ? "Submitting…" : hasPending ? "Pending request in review" : "Request Withdrawal"}
            </button>
          </div>

          {/* History Section */}
          <div>
            <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">History</h3>
            <div className="space-y-2">
              {(history ?? []).map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-xl border border-border bg-card/60 p-3">
                  <div>
                    <p className="text-sm font-bold">{h.diamonds.toLocaleString()} pts → Rs. {Number(h.amount_pkr).toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground">{h.method} · {new Date(h.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${statusColor(h.status)}`}>
                    {h.status}
                  </span>
                </div>
              ))}
              {(history ?? []).length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">No withdrawals yet</p>
              )}
            </div>
          </div>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function statusColor(s: string) {
  if (s === "approved" || s === "completed") return "bg-green-500/20 text-green-400";
  if (s === "rejected") return "bg-red-500/20 text-red-400";
  return "bg-yellow-500/20 text-yellow-400";
}
