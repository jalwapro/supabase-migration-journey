import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Coins, Wallet, ArrowUpFromLine, Gift } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance-reports")({
  component: FinanceReports,
});

function useFinanceSums() {
  return useQuery({
    queryKey: ["finance_report_sums"],
    queryFn: async (): Promise<{ approvedRecharge: number; approvedWithdrawal: number; pendingRecharge: number; pendingWithdrawal: number }> => {
      const { data, error } = await supabase.rpc("get_finance_report_sums");
      if (error || !data) return { approvedRecharge: 0, approvedWithdrawal: 0, pendingRecharge: 0, pendingWithdrawal: 0 };
      return {
        approvedRecharge: Number(data.approved_recharge ?? 0),
        approvedWithdrawal: Number(data.approved_withdrawal ?? 0),
        pendingRecharge: Number(data.pending_recharge ?? 0),
        pendingWithdrawal: Number(data.pending_withdrawal ?? 0),
      };
    },
    staleTime: 120_000,
    gcTime: 10 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

function FinanceReports() {
  const finance = useFinanceSums();

  return (
    <>
      <AdminPageHeader title="Finance Reports" subtitle="Money in / money out" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label="Recharged (approved)" value={finance.data?.approvedRecharge ?? 0} icon={Wallet} tone="bg-emerald-500/15 text-emerald-400" />
        <Card label="Withdrawn (approved)" value={finance.data?.approvedWithdrawal ?? 0} icon={ArrowUpFromLine} tone="bg-red-500/15 text-red-400" />
        <Card label="Recharge pending" value={finance.data?.pendingRecharge ?? 0} icon={Coins} tone="bg-[color:var(--gold)]/15 text-[color:var(--gold)]" />
        <Card label="Withdraw pending" value={finance.data?.pendingWithdrawal ?? 0} icon={Gift} tone="bg-primary/15 text-primary" />
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
