import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Gamepad2, ArrowRight, Sparkles } from "lucide-react";
import { TheatreCard, TheatreDivider, TheatreRow } from "@/components/theatre/TheatreCard";

export const Route = createFileRoute("/_authenticated/games/")({
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
        .select("id,slug,name,description,icon,min_bet,max_bet")
        .eq("active", true);
      if (error) throw error;
      return (data ?? []) as Game[];
    },
  });

  return (
    <>
      <AppShell title="Games" subtitle="Play & win coins">
        <TheatreCard>
          <div className="px-6 pt-8 pb-3 text-center">
            <div className="relative mx-auto w-fit">
              <Gamepad2
                className="h-12 w-12 text-[#ffd66a] drop-shadow-[0_0_16px_rgba(255,200,80,0.9)]"
                strokeWidth={2}
              />
              <div className="absolute -inset-3 rounded-full bg-[#ffd66a]/25 blur-2xl" />
            </div>
            <p className="mt-3 text-xl font-black tracking-wide text-white">Arcade Hall</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#ffcf6a]/70">
              Play · Win · Collect
            </p>
          </div>

          <TheatreDivider label="Featured" />

          <div className="space-y-3 px-3 pt-5 pb-6">
            <Link to="/games/daily-spin" className="block">
              <TheatreRow className="border-[#ffcf6a]/40">
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-3xl shadow-[0_6px_18px_rgba(255,207,106,0.45)]"
                    style={{
                      background:
                        "linear-gradient(135deg,#ffe8a8,#ffcf6a 45%,#c48a1a)",
                    }}
                  >
                    🎁
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-white">Daily Spin</p>
                    <p className="truncate text-[11px] text-white/60">
                      Free reward every 24 hours — coins, diamonds, frames &amp; themes
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-[#ffcf6a]">
                      <Sparkles className="h-3 w-3" /> Free to spin
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[#ffcf6a]/70" />
                </div>
              </TheatreRow>
            </Link>

            {games.isLoading && (
              <p className="py-8 text-center text-sm text-white/50">Loading…</p>
            )}
            {games.data?.map((g) => {
              const to = g.slug === "lucky_spin" ? "/games/lucky-spin" : "/games";
              return (
                <Link key={g.id} to={to} className="block">
                  <TheatreRow>
                    <div className="flex items-center gap-3">
                      <div
                        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-[#ffcf6a]/30 text-3xl"
                        style={{
                          background:
                            "linear-gradient(135deg,rgba(255,207,106,0.25),rgba(120,60,20,0.35))",
                        }}
                      >
                        {g.icon ?? <Gamepad2 className="h-6 w-6 text-[#ffcf6a]" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-white">{g.name}</p>
                        <p className="truncate text-[11px] text-white/60">{g.description}</p>
                        <p className="mt-0.5 text-[10px] font-bold text-[#ffcf6a]">
                          Bet {g.min_bet.toLocaleString()} – {g.max_bet.toLocaleString()}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-[#ffcf6a]/70" />
                    </div>
                  </TheatreRow>
                </Link>
              );
            })}
          </div>
        </TheatreCard>
      </AppShell>
      <BottomNav />
    </>
  );
}
