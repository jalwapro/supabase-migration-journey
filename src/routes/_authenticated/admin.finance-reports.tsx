import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Coins, Wallet, ArrowUpFromLine, Gift } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance-reports")({
  component: FinanceReports,
});

function useSum(status: "approved" | "pending", table: "recharge_requests" | "withdrawal_requests") {
  return useQuery({
    queryKey: ["fin_sum", table, status],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("get_finance_report_sums", {
        p_status: status,
      });
      if (error || !data) return 0;
      const row = table === "recharge_requests" ? data.recharge : data.withdrawal;
      return Number(row ?? 0);
    },
    staleTime: 120_000,
    gcTime: 10 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

function FinanceReports() {
  const recharged = useSum("approved", "recharge_requests");
  const withdrawn = useSum("approved", "withdrawal_requests");
  const pendingR = useSum("pending", "recharge_requests");
  const pendingW = useSum("pending", "withdrawal_requests");

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
