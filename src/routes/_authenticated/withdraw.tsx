import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/withdraw")({ component: Page });

const RATE = 0.5; // 1 point = 0.5 PKR (adjust as needed)

function Page() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [diamonds, setDiamonds] = useState(1000);
  const [method, setMethod] = useState<"jazzcash" | "easypaisa" | "bank" | "manual">("jazzcash");
  const [accNum, setAccNum] = useState("");
  const [accName, setAccName] = useState("");

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
  const amount = Math.max(0, diamonds * RATE);

  async function submit() {
    if (!user) return;
    if (diamonds < 100) return toast.error("Minimum 100 diamonds");
    if (diamonds > balance) return toast.error("Not enough diamonds");
    if (!accNum || !accName) return toast.error("Fill account details");
    const { error } = await supabase.from("withdrawal_requests").insert({
      user_id: user.id,
      diamonds,
      amount_pkr: amount,
      method,
      account_number: accNum,
      account_name: accName,
    });
    if (error) return toast.error(error.message);
    toast.success("Withdrawal requested");
    qc.invalidateQueries({ queryKey: ["withdrawals"] });
  }

  return (
    <>
      <AppShell title="Withdraw Diamonds">
        <div className="space-y-4 px-4 pt-4">
          <div className="glass rounded-3xl p-4 text-center">
            <p className="text-xs text-muted-foreground">Available balance</p>
            <p className="mt-1 text-3xl font-black text-[color:var(--gold)]">💎 {balance.toLocaleString()}</p>
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-4">
            <Field label="Diamonds to withdraw">
              <input
                type="number"
                min={100}
                value={diamonds}
                onChange={(e) => setDiamonds(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm outline-none"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">≈ Rs. {amount.toLocaleString()}</p>
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
            <Field label="Account number / IBAN">
              <input
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
              className="w-full rounded-xl bg-[color:var(--gold)] py-3 text-sm font-black text-black"
            >
              Request Withdrawal
            </button>
          </div>

          <div>
            <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">History</h3>
            <div className="space-y-2">
              {(history ?? []).map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-xl border border-border bg-card/60 p-3">
                  <div>
                    <p className="text-sm font-bold">💎 {h.diamonds.toLocaleString()} → Rs. {Number(h.amount_pkr).toLocaleString()}</p>
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
