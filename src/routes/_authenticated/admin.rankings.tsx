import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Trophy, Diamond, Crown, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/rankings")({
  component: RankingsAdmin,
});

type P = {
  id: string;
  username: string | null;
  avatar: string | null;
  level: number;
  xp: number;
  diamonds: number;
  coins: number;
  is_vip: boolean;
};

function useTop(orderBy: "xp" | "diamonds" | "coins") {
  return useQuery({
    queryKey: ["admin_rank", orderBy],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,avatar,level,xp,diamonds,coins,is_vip")
        .order(orderBy, { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as P[];
    },
  });
}

function List({ title, icon: Icon, rows, valueKey }: { title: string; icon: typeof Trophy; rows?: P[]; valueKey: keyof P }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[color:var(--gold)]" />
        <p className="text-sm font-bold">{title}</p>
      </div>
      <div className="space-y-1.5">
        {rows?.slice(0, 20).map((p, i) => (
          <div key={p.id} className="flex items-center gap-2 rounded-lg bg-card/40 px-2 py-1.5">
            <span className="w-5 text-center text-[11px] font-bold text-muted-foreground">{i + 1}</span>
            <div className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-primary/20">
              {p.avatar ? <img src={p.avatar} className="h-full w-full object-cover" alt="" /> : <Users className="h-3 w-3" />}
            </div>
            <p className="min-w-0 flex-1 truncate text-xs">@{p.username ?? "user"}</p>
            {p.is_vip && <Crown className="h-3 w-3 text-[color:var(--gold)]" />}
            <span className="text-[11px] font-bold text-[color:var(--gold)]">{Number(p[valueKey]).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankingsAdmin() {
  const xp = useTop("xp");
  const diamonds = useTop("diamonds");
  const coins = useTop("coins");

  return (
    <>
      <AdminPageHeader title="Rankings" subtitle="Live leaderboards" />
      <div className="grid gap-3 md:grid-cols-3">
        <List title="Top by XP / Level" icon={Trophy} rows={xp.data} valueKey="xp" />
        <List title="Top Earners (Diamonds)" icon={Diamond} rows={diamonds.data} valueKey="diamonds" />
        <List title="Top Spenders (Coins)" icon={Crown} rows={coins.data} valueKey="coins" />
      </div>
    </>
  );
}
