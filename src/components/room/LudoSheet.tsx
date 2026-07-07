import { X, Coins, Trophy, Dice5 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export type LudoPlayer = {
  id: string;
  username: string | null;
  avatar: string | null;
};

const COLORS = ["#ef4444", "#22c55e", "#eab308", "#3b82f6"];

export function LudoSheet({
  open,
  onClose,
  players,
  isHost,
}: {
  open: boolean;
  onClose: () => void;
  players: LudoPlayer[];
  isHost: boolean;
}) {
  const [bet, setBet] = useState(100);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t border-border bg-card p-5 shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <Dice5 className="h-5 w-5 text-[color:var(--primary)]" /> Ludo Battle
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full bg-background/60 border border-border"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Players / seats (4) */}
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => {
            const p = players[i];
            return (
              <div
                key={i}
                className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-background/60 p-2"
                style={{ boxShadow: `inset 0 0 0 2px ${COLORS[i]}22` }}
              >
                <div
                  className="grid h-12 w-12 place-items-center overflow-hidden rounded-full"
                  style={{ background: COLORS[i] }}
                >
                  {p?.avatar ? (
                    <img src={p.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-white">P{i + 1}</span>
                  )}
                </div>
                <span className="truncate max-w-full text-[10px] text-muted-foreground">
                  {p?.username ? `@${p.username}` : "Waiting…"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Bet */}
        <div className="mt-4 rounded-2xl border border-border bg-background/60 p-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Coins className="h-3.5 w-3.5 text-[color:var(--gold)]" />
              Entry bet
            </span>
            <span className="text-[color:var(--gold)] font-bold">{bet} coins</span>
          </div>
          <div className="mt-2 flex gap-2">
            {[50, 100, 500, 1000].map((v) => (
              <button
                key={v}
                onClick={() => setBet(v)}
                className={`flex-1 rounded-full py-1.5 text-xs font-bold ${
                  bet === v
                    ? "bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] text-primary-foreground"
                    : "border border-border"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Trophy className="h-3 w-3 text-[color:var(--gold)]" /> Winner takes
            </span>
            <span className="font-bold text-[color:var(--gold)]">
              {bet * 4} coins
            </span>
          </div>
        </div>

        {/* Placeholder board */}
        <div className="mt-4 aspect-square w-full rounded-2xl border border-border bg-background/60 p-3">
          <div className="grid h-full grid-cols-3 grid-rows-3 gap-2">
            {[0, 1, 2, 3].map((i) => {
              const positions = [
                { col: "1 / 2", row: "1 / 2" },
                { col: "3 / 4", row: "1 / 2" },
                { col: "1 / 2", row: "3 / 4" },
                { col: "3 / 4", row: "3 / 4" },
              ][i];
              return (
                <div
                  key={i}
                  style={{
                    gridColumn: positions.col,
                    gridRow: positions.row,
                    background: `${COLORS[i]}33`,
                    border: `2px solid ${COLORS[i]}`,
                  }}
                  className="rounded-xl grid place-items-center text-xs font-bold"
                >
                  P{i + 1}
                </div>
              );
            })}
            <div
              className="col-start-2 row-start-2 grid place-items-center rounded-xl bg-gradient-to-br from-[color:var(--primary)]/20 to-[color:var(--secondary)]/20"
            >
              <span className="text-center text-[10px] font-semibold text-muted-foreground">
                Ludo board<br />coming next
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            if (!isHost) {
              toast.info("Only host can start the match");
              return;
            }
            toast.success("Ludo match will launch in Phase 2");
          }}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] py-3.5 text-sm font-extrabold text-primary-foreground"
        >
          <Dice5 className="h-4 w-4" />
          {isHost ? "Start Match" : "Join & Wait for Host"}
        </button>
      </div>
    </>
  );
}
