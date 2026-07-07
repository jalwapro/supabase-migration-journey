import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Gamepad2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/games")({
  component: GamesPage,
});

type Game = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  min_bet: number;
  max_bet: number;
};

function GamesPage() {
  const games = useQuery({
    queryKey: ["games"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("games")
        .select("*")
        .eq("active", true);
      if (error) throw error;
      return (data ?? []) as Game[];
    },
  });

  return (
    <>
      <AppShell title="Games" subtitle="Play & win coins">
        <div className="space-y-3 px-4 pt-4">
          {games.isLoading && (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          )}
          {games.data?.map((g) => {
            const to =
              g.slug === "lucky_spin" ? "/games/lucky-spin" : "/games";
            return (
              <Link
                key={g.id}
                to={to}
                className="glass flex items-center gap-3 rounded-2xl p-4"
              >
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[color:var(--gold)]/30 to-[color:var(--primary)]/30 text-3xl">
                  {g.icon ?? <Gamepad2 className="h-6 w-6" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{g.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {g.description}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[color:var(--gold)]">
                    Bet {g.min_bet.toLocaleString()} – {g.max_bet.toLocaleString()}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
