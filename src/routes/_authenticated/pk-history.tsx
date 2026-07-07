import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/pk-history")({ component: Page });

function Page() {
  const { user } = useAuth();
  const { data: battles } = useQuery({
    queryKey: ["pk", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("pk_battles")
        .select("*")
        .eq("host_id", user!.id)
        .order("started_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const wins = (battles ?? []).filter((b) => b.result === "win").length;
  const losses = (battles ?? []).filter((b) => b.result === "loss").length;
  const draws = (battles ?? []).filter((b) => b.result === "draw").length;

  return (
    <>
      <AppShell title="PK History">
        <div className="space-y-3 px-4 pt-4">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Wins" value={wins} color="text-green-400" />
            <Stat label="Losses" value={losses} color="text-red-400" />
            <Stat label="Draws" value={draws} color="text-muted-foreground" />
          </div>
          <div className="space-y-2">
            {(battles ?? []).map((b) => (
              <div key={b.id} className="rounded-2xl border border-border bg-card/60 p-3">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-bold">{b.room_title}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      b.result === "win"
                        ? "bg-green-500/20 text-green-400"
                        : b.result === "loss"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {b.result}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  You {b.my_score.toLocaleString()} vs {b.opponent_name} {b.opponent_score.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">{new Date(b.started_at).toLocaleString()}</p>
              </div>
            ))}
            {(battles ?? []).length === 0 && (
              <p className="py-10 text-center text-xs text-muted-foreground">No PK battles yet</p>
            )}
          </div>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 py-3 text-center">
      <p className={`text-xl font-black ${color}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
