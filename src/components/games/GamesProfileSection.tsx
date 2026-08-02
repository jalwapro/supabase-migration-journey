import { Link } from "@tanstack/react-router";
import { Gamepad2, Trophy, Coins, Flame, Award } from "lucide-react";
import { useMyGameSummary } from "@/lib/minigames";

/** "Games" section for the profile page — real backend stats only. */
export function GamesProfileSection({ userId }: { userId: string | null | undefined }) {
  const summary = useMyGameSummary(userId);
  const d = summary.data;

  const badges: { label: string; icon: string; earned: boolean }[] = [
    { label: "First Play", icon: "🎮", earned: (d?.plays ?? 0) >= 1 },
    { label: "10 Wins", icon: "🏆", earned: (d?.wins ?? 0) >= 10 },
    { label: "Coin Hunter", icon: "💰", earned: (d?.coins_won ?? 0) >= 10000 },
    { label: "7-Day Streak", icon: "🔥", earned: (d?.streak ?? 0) >= 7 },
    { label: "Veteran", icon: "🎖️", earned: (d?.plays ?? 0) >= 100 },
    { label: "High Roller", icon: "👑", earned: (d?.coins_spent ?? 0) >= 50000 },
  ];

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-foreground/80">
          <Gamepad2 className="h-4 w-4 text-[color:var(--gold)]" /> Games
        </h3>
        <Link to="/games" className="text-[11px] font-bold text-[color:var(--gold)]">
          Play →
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Cell label="Played" value={d?.plays ?? 0} />
        <Cell label="Wins" value={d?.wins ?? 0} icon={<Trophy className="h-3 w-3" />} />
        <Cell label="Earned" value={(d?.coins_won ?? 0).toLocaleString()} icon={<Coins className="h-3 w-3" />} />
        <Cell label="Streak" value={`${d?.streak ?? 0}d`} icon={<Flame className="h-3 w-3" />} />
      </div>

      {(d?.games?.length ?? 0) > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/50">Highest scores</p>
          {d!.games.slice(0, 5).map((g) => (
            <div key={g.slug} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <span className="text-lg">{g.icon}</span>
              <span className="min-w-0 flex-1 truncate text-xs font-bold">{g.name}</span>
              <span className="text-xs font-black text-[color:var(--gold)]">{g.best_score}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-foreground/50">
          <Award className="mr-1 inline h-3 w-3" /> Badges
        </p>
        <div className="flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <span
              key={b.label}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                b.earned
                  ? "border-[color:var(--gold)]/50 bg-[color:var(--gold)]/15 text-[color:var(--gold)]"
                  : "border-white/10 bg-white/5 text-foreground/35"
              }`}
            >
              {b.icon} {b.label}
            </span>
          ))}
        </div>
      </div>

      {(d?.history?.length ?? 0) > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-foreground/50">Win history</p>
          <div className="space-y-1">
            {d!.history.slice(0, 6).map((h, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-1.5 text-[11px]">
                <span className="truncate font-bold text-foreground/80">{h.slug.replace(/_/g, " ")}</span>
                <span className={h.reward > h.entry ? "font-black text-emerald-400" : "font-bold text-foreground/50"}>
                  {h.reward > 0 ? `+${h.reward.toLocaleString()}` : `-${h.entry.toLocaleString()}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Cell({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-2 py-2 text-center">
      <p className="flex items-center justify-center gap-0.5 text-[9px] font-bold uppercase tracking-widest text-foreground/50">
        {icon} {label}
      </p>
      <p className="truncate text-sm font-black">{value}</p>
    </div>
  );
}
