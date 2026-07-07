import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Coins, Wallet, ArrowUpFromLine, Gift } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance-reports")({
  component: FinanceReports,
});

function useSum(table: string, col: string, filter?: { c: string; v: string }) {
  return useQuery({
    queryKey: ["fin_sum", table, col, filter],
    queryFn: async (): Promise<number> => {
      let q = supabase.from(table).select(col);
      if (filter) q = q.eq(filter.c, filter.v);
      const { data, error } = await q;
      if (error || !data) return 0;
      return (data as Array<Record<string, unknown>>).reduce(
        (s, r) => s + Number(r[col] ?? 0),
        0,
      );
    },
  });
}

function FinanceReports() {
  const recharged = useSum("recharge_requests", "amount_paid", { c: "status", v: "approved" });
  const withdrawn = useSum("withdrawal_requests", "amount_pkr", { c: "status", v: "approved" });
  const pendingR = useSum("recharge_requests", "amount_paid", { c: "status", v: "pending" });
  const pendingW = useSum("withdrawal_requests", "amount_pkr", { c: "status", v: "pending" });

  return (
    <>
      <AdminPageHeader title="Finance Reports" subtitle="Money in / money out" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label="Recharged (approved)" value={recharged.data ?? 0} icon={Wallet} tone="bg-emerald-500/15 text-emerald-400" />
        <Card label="Withdrawn (approved)" value={withdrawn.data ?? 0} icon={ArrowUpFromLine} tone="bg-red-500/15 text-red-400" />
        <Card label="Recharge pending" value={pendingR.data ?? 0} icon={Coins} tone="bg-[color:var(--gold)]/15 text-[color:var(--gold)]" />
        <Card label="Withdraw pending" value={pendingW.data ?? 0} icon={Gift} tone="bg-primary/15 text-primary" />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Amounts in PKR. Updated live from recharge_requests / withdrawal_requests.</p>
    </>
  );
}

function Card({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Wallet; tone: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></div>
      </div>
      <p className="mt-3 text-lg font-bold">PKR {Number(value).toLocaleString()}</p>
    </div>
  );
}
