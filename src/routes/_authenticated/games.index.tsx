import { createFileRoute, Link } from "@tanstack/react-router";
import { Gamepad2, Trophy, Coins, Flame, Loader2, Dices } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useMiniGames, useMyGameSummary } from "@/lib/minigames";

export const Route = createFileRoute("/_authenticated/games/")({
  head: () => ({
    meta: [
      { title: "Game Center — Play & Win Coins | Jalwa" },
      { name: "description", content: "Play 10 premium mini games — spin, match, tap and quiz your way to more coins." },
      { property: "og:title", content: "Jalwa Game Center" },
      { property: "og:description", content: "Play 10 premium mini games and win coins instantly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameCenter,
});

function GameCenter() {
  const { user, profile } = useAuth();
  const games = useMiniGames();
  const summary = useMyGameSummary(user?.id);

  return (
    <>
      <AppShell title="Game Center" subtitle="Play · Win · Climb">
        <div className="mx-auto max-w-md px-4 pb-6">
          {/* hero */}
          <section className="relative mt-2 overflow-hidden rounded-3xl border border-[color:var(--gold)]/30 bg-gradient-to-br from-[color:var(--primary)]/25 via-[color:var(--secondary)]/20 to-transparent p-5">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[color:var(--gold)]/20 blur-3xl" />
            <div className="relative flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-[color:var(--gold)]/50 bg-black/30">
                <Gamepad2 className="h-7 w-7 text-[color:var(--gold)]" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-black">Mini Games</p>
                <p className="text-[11px] text-foreground/60">
                  Fair play · server-verified rewards
                </p>
              </div>
            </div>
            <div className="relative mt-4 grid grid-cols-3 gap-2">
              <Stat icon={<Coins className="h-3.5 w-3.5" />} label="Balance" value={(profile?.coins ?? 0).toLocaleString()} />
              <Stat icon={<Trophy className="h-3.5 w-3.5" />} label="Won" value={(summary.data?.coins_won ?? 0).toLocaleString()} />
              <Stat icon={<Flame className="h-3.5 w-3.5" />} label="Streak" value={`${summary.data?.streak ?? 0}d`} />
            </div>
          </section>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              to="/games/leaderboard"
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 text-xs font-black uppercase tracking-widest"
            >
              <Trophy className="h-4 w-4 text-[color:var(--gold)]" /> Leaderboard
            </Link>
            <Link
              to="/games/daily-spin"
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 text-xs font-black uppercase tracking-widest"
            >
              <Dices className="h-4 w-4 text-[color:var(--primary)]" /> Classic Spin
            </Link>
          </div>

          <Link
            to="/games/ludo-replays"
            className="mt-2 flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 text-xs font-black uppercase tracking-widest"
          >
            <Dices className="h-4 w-4 text-[color:var(--secondary)]" /> Ludo Replays
          </Link>

          {/* grid */}
          <h2 className="mt-6 mb-2 text-xs font-black uppercase tracking-widest text-foreground/70">
            All games
          </h2>
          {games.isLoading ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-[color:var(--gold)]" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {games.data?.map((g, i) => (
                <Link
                  key={g.id}
                  to="/games/play/$slug"
                  params={{ slug: g.slug }}
                  className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 transition-transform active:scale-[0.97]"
                  style={{ animation: `gcIn .35s ${i * 0.04}s both` }}
                >
                  <div
                    className="absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl"
                    style={{ background: `${g.color}44` }}
                  />
                  <div
                    className="relative grid h-14 w-14 place-items-center rounded-2xl text-3xl"
                    style={{ background: `${g.color}22`, border: `1px solid ${g.color}66` }}
                  >
                    {g.icon}
                  </div>
                  <p className="relative mt-3 truncate text-sm font-black">{g.name}</p>
                  <p className="relative mt-0.5 line-clamp-2 h-8 text-[10px] leading-4 text-foreground/55">
                    {g.description}
                  </p>
                  <div className="relative mt-2 flex items-center justify-between">
                    <span className="rounded-full bg-[color:var(--gold)]/15 px-2 py-0.5 text-[10px] font-black text-[color:var(--gold)]">
                      {g.entry_cost > 0 ? `${g.entry_cost} coins` : "FREE"}
                    </span>
                    {g.maintenance && (
                      <span className="text-[9px] font-bold uppercase text-amber-400">Maintenance</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* my stats */}
          {summary.data && summary.data.plays > 0 && (
            <>
              <h2 className="mt-7 mb-2 text-xs font-black uppercase tracking-widest text-foreground/70">
                My performance
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Games played" value={summary.data.plays} />
                <Stat label="Wins" value={summary.data.wins} />
                <Stat label="Coins spent" value={summary.data.coins_spent.toLocaleString()} />
                <Stat label="Coins earned" value={summary.data.coins_won.toLocaleString()} />
              </div>
            </>
          )}
          <style>{`@keyframes gcIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
      <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-foreground/50">
        {icon} {label}
      </p>
      <p className="truncate text-sm font-black">{value}</p>
    </div>
  );
}
