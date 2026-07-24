import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { ArrowLeft, Loader2, CheckCircle2, Clock, XCircle, Receipt } from "lucide-react";
import jalwaCoin from "@/assets/jalwa-coin.png.asset.json";

export const Route = createFileRoute("/_authenticated/recharge-history")({
  component: RechargeHistoryPage,
});

type Order = {
  id: string;
  method: string;
  account_ref: string | null;
  amount_pkr: number;
  coins_total: number;
  status: string;
  created_at: string;
};

type Request = {
  id: string;
  amount_pkr: number;
  coins_expected: number;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  created_at: string;
};

const COIN_URL_ABS = `https://cloud-to-soul.lovable.app${jalwaCoin.url}`;
const CoinIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <img
    src={jalwaCoin.url}
    alt=""
    onError={(e) => {
      const img = e.currentTarget;
      if (img.src !== COIN_URL_ABS) img.src = COIN_URL_ABS;
    }}
    className={`${className} drop-shadow-[0_0_6px_rgba(255,200,60,0.6)]`}
  />
);

/**
 * Status shown to the user is derived from BOTH the recharge_orders row
 * (OTP progress) AND the linked recharge_requests row (admin approval).
 * "completed" on the order only means OTP verified — coins are credited
 * only when the admin approves the request.
 */
function statusMeta(effective: string) {
  if (effective === "approved")
    return { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15", label: "Coins credited" };
  if (effective === "rejected")
    return { icon: XCircle, color: "text-red-400", bg: "bg-red-500/15", label: "Rejected" };
  if (effective === "awaiting_admin")
    return { icon: Clock, color: "text-sky-400", bg: "bg-sky-500/15", label: "Awaiting approval" };
  if (effective === "pending_otp" || effective === "pending")
    return { icon: Clock, color: "text-amber-400", bg: "bg-amber-500/15", label: "Pending OTP" };
  return { icon: XCircle, color: "text-red-400", bg: "bg-red-500/15", label: effective.replace(/_/g, " ") };
}

function RechargeHistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const orders = useQuery({
    queryKey: ["recharge_orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recharge_orders")
        .select("id,method,account_ref,amount_pkr,coins_total,status,created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });

  return (
    <>
      <AppShell
        title="Recharge History"
        subtitle="Your top-up requests & status"
        right={
          <button
            onClick={() => navigate({ to: "/me" })}
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-full bg-card/60"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        }
      >
        <div className="space-y-3 px-4 pt-4 pb-8">
          {orders.isLoading && (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!orders.isLoading && (orders.data?.length ?? 0) === 0 && (
            <div className="rounded-2xl border border-border bg-card/60 p-8 text-center">
              <Receipt className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-bold">No recharges yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your recharge requests will appear here
              </p>
            </div>
          )}

          {orders.data?.map((o) => {
            const s = statusMeta(o.status);
            const Icon = s.icon;
            return (
              <div key={o.id} className="rounded-2xl border border-border bg-card/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <CoinIcon className="h-4 w-4" />
                      <span className="text-lg font-black">
                        {Number(o.coins_total).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm font-bold text-[color:var(--gold)]">
                      Rs {Number(o.amount_pkr).toLocaleString()}
                    </p>
                    <p className="mt-1 text-[11px] capitalize text-muted-foreground">
                      {o.method}{o.account_ref ? ` · ${o.account_ref}` : ""}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {new Date(o.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${s.bg} ${s.color}`}
                  >
                    <Icon className="h-3 w-3" />
                    {s.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
