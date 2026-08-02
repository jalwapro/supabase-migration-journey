import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Crown, Loader2, Trophy } from "lucide-react";
import { BottomNav } from "@/components/layout/BottomNav";
import { useLeaderboard, useMiniGames } from "@/lib/minigames";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/games/leaderboard")({
  head: () => ({
    meta: [
      { title: "Game Leaderboard — Top Players | Jalwa" },
      { name: "description", content: "Daily, weekly, monthly and all-time mini game champions on Jalwa." },
      { property: "og:title", content: "Jalwa Game Leaderboard" },
      { property: "og:description", content: "See the top mini game players of the day, week and month." },
    ],
  }),
  component: LeaderboardPage,
});

const PERIODS = [
  { key: "daily", label: "Today" },
  { key: "weekly", label: "Week" },
  { key: "monthly", label: "Month" },
  { key: "all", label: "All time" },
] as const;

function LeaderboardPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("daily");
  const [slug, setSlug] = useState<string | null>(null);
  const games = useMiniGames();
  const rows = useLeaderboard(period, slug);

  return (
    <>
      <div className="min-h-[100dvh] bg-background pb-28">
        <header
          className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
            <Link to="/games" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-base font-black">Leaderboard</p>
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Top players</p>
            </div>
          </div>
          <div className="mx-auto max-w-md px-4 pb-3">
            <div className="grid grid-cols-4 gap-1 rounded-full border border-white/10 bg-white/5 p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`rounded-full py-1.5 text-[11px] font-black ${
                    period === p.key
                      ? "bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] text-primary-foreground"
                      : "text-foreground/70"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              <Chip active={slug === null} onClick={() => setSlug(null)}>All games</Chip>
              {games.data?.map((g) => (
                <Chip key={g.slug} active={slug === g.slug} onClick={() => setSlug(g.slug)}>
                  {g.icon} {g.name}
                </Chip>
              ))}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-md px-4 py-4">
          {rows.isLoading ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-[color:var(--gold)]" />
            </div>
          ) : (rows.data?.length ?? 0) === 0 ? (
            <p className="py-16 text-center text-sm text-foreground/50">No games played yet — be the first!</p>
          ) : (
            <div className="space-y-2">
              {rows.data!.map((r, i) => (
                <div
                  key={r.user_id}
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${
                    r.user_id === user?.id
                      ? "border-[color:var(--gold)]/60 bg-[color:var(--gold)]/10"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black ${
                      i === 0 ? "bg-[#ffd66a] text-black" : i === 1 ? "bg-slate-300 text-black" : i === 2 ? "bg-amber-700 text-white" : "bg-white/10"
                    }`}
                  >
                    {i < 3 ? <Crown className="h-4 w-4" /> : i + 1}
                  </span>
                  <img
                    src={r.avatar ?? "/placeholder.svg"}
                    alt=""
                    loading="lazy"
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">@{r.username ?? "player"}</p>
                    <p className="text-[10px] text-foreground/50">{r.plays} plays · best {r.score}</p>
                  </div>
                  <span className="flex items-center gap-1 text-sm font-black text-[color:var(--gold)]">
                    <Trophy className="h-3.5 w-3.5" />
                    {Number(r.coins_won).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
      <BottomNav />
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-bold ${
        active ? "border-[color:var(--primary)] bg-[color:var(--primary)]/20" : "border-white/10 bg-white/5 text-foreground/70"
      }`}
    >
      {children}
    </button>
  );
}
