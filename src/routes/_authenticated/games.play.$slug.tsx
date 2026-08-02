import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Coins, Loader2, Sparkles, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  friendlyGameError,
  useGameSession,
  useMiniGame,
  type FinishResult,
  type StartResult,
} from "@/lib/minigames";
import { GAME_COMPONENTS } from "@/components/games/GameKit";

export const Route = createFileRoute("/_authenticated/games/play/$slug")({
  head: () => ({
    meta: [
      { title: "Play · Jalwa Game Center" },
      { name: "description", content: "Play premium mini games and win coins instantly on Jalwa." },
      { property: "og:title", content: "Jalwa Game Center" },
      { property: "og:description", content: "Play premium mini games and win coins instantly." },
    ],
  }),
  component: PlayGame,
});

function PlayGame() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { profile, refresh } = useAuth();
  const game = useMiniGame(slug);
  const { start, finish } = useGameSession(slug);

  const [session, setSession] = useState<StartResult | null>(null);
  const [result, setResult] = useState<FinishResult | null>(null);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.session_id]);

  const g = game.data;
  const Component = GAME_COMPONENTS[slug];

  const begin = () => {
    setResult(null);
    start.mutate(undefined, {
      onSuccess: (s) => setSession(s),
      onError: (e) => toast.error(friendlyGameError(e)),
    });
  };

  const submit = (score: number, meta?: Record<string, unknown>) => {
    if (!session || finish.isPending) return;
    finish.mutate(
      { sessionId: session.session_id, score, meta },
      {
        onSuccess: (r) => {
          setResult(r);
          setSession(null);
          if (r.reward_coins > 0) toast.success(`+${r.reward_coins.toLocaleString()} coins`);
        },
        onError: (e) => toast.error(friendlyGameError(e)),
      },
    );
  };

  if (game.isLoading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-[color:var(--gold)]" />
      </div>
    );
  }

  if (!g || !Component) {
    return (
      <div className="grid min-h-[100dvh] place-items-center p-6 text-center">
        <div>
          <p className="text-lg font-black">Game not available</p>
          <Link to="/games" className="mt-3 inline-block text-xs font-bold text-[color:var(--gold)]">
            Back to Game Center
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-10">
      <header
        className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate({ to: "/games" })}
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-black">{g.icon} {g.name}</p>
            <p className="truncate text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              {g.difficulty} · {g.entry_cost > 0 ? `${g.entry_cost} coins entry` : "Free"}
            </p>
          </div>
          <span className="flex items-center gap-1 rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-3 py-1 text-xs font-black text-[color:var(--gold)]">
            <Coins className="h-3.5 w-3.5" />
            {(profile?.coins ?? 0).toLocaleString()}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-5">
        {g.maintenance && (
          <p className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3 text-center text-xs font-bold text-amber-300">
            This game is under maintenance. Please try again later.
          </p>
        )}

        {!session && !result && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl text-5xl"
              style={{ background: `${g.color}22`, border: `2px solid ${g.color}66` }}>
              {g.icon}
            </div>
            <p className="mt-4 text-lg font-black">{g.name}</p>
            <p className="mt-1 text-xs text-foreground/60">{g.description}</p>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <Info label="Entry" value={g.entry_cost > 0 ? g.entry_cost.toLocaleString() : "Free"} />
              <Info label="Max win" value={maxWin(g.entry_cost, g.reward_base, g.config)} />
              <Info label="XP" value={`+${g.xp_reward}`} />
            </div>

            <button
              onClick={begin}
              disabled={start.isPending || g.maintenance}
              className="mt-6 w-full rounded-2xl bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] py-3.5 text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-50"
            >
              {start.isPending ? "Starting…" : g.entry_cost > 0 ? `Play · ${g.entry_cost} coins` : "Play free"}
            </button>
            <p className="mt-3 text-[10px] text-foreground/40">
              Rewards are calculated and paid by the server only.
            </p>
          </div>
        )}

        {session && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <Component
              config={g.config ?? {}}
              prizeIndex={Number(session.payload?.prize_index ?? 0)}
              onSubmit={submit}
              submitting={finish.isPending}
            />
          </div>
        )}

        {result && (
          <div className="rounded-3xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 p-6 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-[color:var(--gold)]" />
            <p className="mt-3 text-2xl font-black text-[color:var(--gold)]">
              {result.reward_coins > 0 ? `+${result.reward_coins.toLocaleString()} coins` : "No reward"}
            </p>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-foreground/60">
              {result.label ?? (result.multiplier > 0 ? `${result.multiplier}x` : "Try again")}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Info label="Score" value={result.score} />
              <Info label="Multiplier" value={`${result.multiplier}x`} />
              <Info label="Balance" value={result.balance.toLocaleString()} />
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={begin}
                disabled={start.isPending}
                className="flex-1 rounded-2xl bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] py-3 text-xs font-black uppercase tracking-widest text-primary-foreground disabled:opacity-50"
              >
                Play again
              </button>
              <Link
                to="/games/leaderboard"
                className="flex-1 rounded-2xl border border-white/15 py-3 text-center text-xs font-black uppercase tracking-widest"
              >
                <Trophy className="mr-1 inline h-3.5 w-3.5" /> Ranks
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-background/40 px-2 py-2">
      <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/50">{label}</p>
      <p className="truncate text-sm font-black">{value}</p>
    </div>
  );
}

function maxWin(entry: number, base: number, config: { mode?: string; tiers?: { mult: number }[]; prizes?: { coins?: number; mult?: number }[] } | null) {
  if (!config) return "—";
  if (config.mode === "weighted") {
    const best = Math.max(0, ...(config.prizes ?? []).map((p) => p.coins ?? Math.floor(Math.max(base, entry) * (p.mult ?? 0))));
    return best.toLocaleString();
  }
  const bestMult = Math.max(0, ...(config.tiers ?? []).map((t) => t.mult));
  return Math.floor(Math.max(base, entry) * bestMult).toLocaleString();
}
