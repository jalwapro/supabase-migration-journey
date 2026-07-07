import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Users, DoorOpen, Wallet, Gift as GiftIcon, Flag, Crown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

function useCount(table: string, filter?: { col: string; val: string }) {
  return useQuery({
    queryKey: ["admin_count", table, filter],
    queryFn: async () => {
      let q = supabase.from(table).select("id", { count: "exact", head: true });
      if (filter) q = q.eq(filter.col, filter.val);
      const { count, error } = await q;
      if (error) return 0;
      return count ?? 0;
    },
  });
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: LucideIcon; tone?: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${tone ?? "bg-primary/15 text-primary"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p>
    </div>
  );
}

function Dashboard() {
  const users = useCount("profiles");
  const rooms = useCount("rooms");
  const pending = useCount("recharge_requests", { col: "status", val: "pending" });
  const gifts = useCount("gifts");
  const reports = useCount("user_reports", { col: "status", val: "pending" });
  const vip = useCount("profiles", { col: "is_vip", val: "true" });

  return (
    <>
      <AdminPageHeader title="Dashboard" subtitle="Live overview of your platform" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Total Users" value={users.data ?? 0} icon={Users} />
        <StatCard label="Live Rooms" value={rooms.data ?? 0} icon={DoorOpen} tone="bg-emerald-500/15 text-emerald-400" />
        <StatCard label="Pending Recharge" value={pending.data ?? 0} icon={Wallet} tone="bg-[color:var(--gold)]/15 text-[color:var(--gold)]" />
        <StatCard label="Gifts Catalog" value={gifts.data ?? 0} icon={GiftIcon} tone="bg-pink-500/15 text-pink-400" />
        <StatCard label="Open Reports" value={reports.data ?? 0} icon={Flag} tone="bg-red-500/15 text-red-400" />
        <StatCard label="VIP Members" value={vip.data ?? 0} icon={Crown} tone="bg-purple-500/15 text-purple-400" />
      </div>
      <div className="glass mt-5 rounded-2xl p-4 text-xs text-muted-foreground">
        <p className="font-bold text-foreground">Welcome, Admin</p>
        <p className="mt-1">Use the sidebar to jump into any module. All Supabase RLS policies and grants are live.</p>
      </div>
    </>
  );
}
