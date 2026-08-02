import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Dices,
  Download,
  Link2,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import {
  buildReplayShareLink,
  downloadReplayJson,
  useLudoMatches,
  useLudoReplay,
  type LudoEvent,
} from "@/lib/ludo-replay";


const KIND_STYLE: Record<string, string> = {
  start: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  roll: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  move: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  capture: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  home: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  skip: "bg-muted text-muted-foreground border-border",
  win: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  abort: "bg-red-500/15 text-red-300 border-red-500/30",
  error: "bg-red-500/20 text-red-300 border-red-500/40",
};

function describe(e: LudoEvent) {
  switch (e.kind) {
    case "start":
      return "Match started";
    case "roll":
      return `Rolled ${e.dice}`;
    case "move":
      return `Token ${((e.token_index ?? 0) + 1)} moved ${e.from_pos ?? "?"} → ${e.to_pos ?? "?"}`;
    case "capture":
      return `Captured at ${e.to_pos ?? "?"}`;
    case "home":
      return `Token ${((e.token_index ?? 0) + 1)} reached home`;
    case "skip":
      return "Turn skipped";
    case "win":
      return "Winner declared";
    case "abort":
      return "Match aborted";
    default:
      return e.rejection ?? "Rejected by server";
  }
}

/**
 * Turn-by-turn Ludo replay + server-validation debugger.
 * Players see their own matches; admins (adminMode) can inspect any match.
 */
export function LudoReplayViewer({
  adminMode = false,
  userId = null,
}: {
  adminMode?: boolean;
  userId?: string | null;
}) {
  const matches = useLudoMatches(adminMode ? userId : null, adminMode ? 60 : 30);
  const [selected, setSelected] = useState<string | null>(null);

  // Deep link support: /games/ludo-replays?match=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("match");
    if (id) setSelected(id);
  }, []);

  const replay = useLudoReplay(selected);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [onlyInvalid, setOnlyInvalid] = useState(false);

  const events = useMemo(() => {
    const all = replay.data?.events ?? [];
    return onlyInvalid ? all.filter((e) => !e.valid) : all;
  }, [replay.data, onlyInvalid]);

  useEffect(() => {
    setCursor(0);
    setPlaying(false);
  }, [selected, onlyInvalid]);

  useEffect(() => {
    if (!playing || events.length === 0) return;
    const t = window.setInterval(() => {
      setCursor((c) => {
        if (c >= events.length - 1) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, 700);
    return () => window.clearInterval(t);
  }, [playing, events.length]);

  const nameOf = (id: string | null) =>
    replay.data?.players.find((p) => p.id === id)?.username ?? (id ? `${id.slice(0, 6)}…` : "System");

  if (!selected) {
    return (
      <div className="space-y-3">
        {matches.isLoading && (
          <div className="grid place-items-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {matches.data?.length === 0 && (
          <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No Ludo matches recorded yet.
          </p>
        )}
        {(matches.data ?? []).map((m) => (
          <button
            key={m.id}
            onClick={() => setSelected(m.id)}
            className="w-full rounded-2xl border border-border bg-card p-3 text-left transition hover:border-[color:var(--primary)]/50"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-bold">
                <Dices className="h-4 w-4 text-[color:var(--primary)]" />
                {m.players.map((p) => p.username ?? "Player").join(" vs ") || "Ludo match"}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{m.status}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>{new Date(m.created_at).toLocaleString()}</span>
              <span>· {m.turn_count} turns</span>
              <span>· {m.event_count} events</span>
              <span>· bet {m.bet_coins}</span>
              {Number(m.invalid_count) > 0 && (
                <span className="flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-red-300">
                  <AlertTriangle className="h-3 w-3" /> {m.invalid_count} rejected
                </span>
              )}
              {m.winner_id && (
                <span className="flex items-center gap-1 text-amber-300">
                  <Trophy className="h-3 w-3" /> winner
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    );
  }

  const current = events[cursor];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Matches
        </button>
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={onlyInvalid}
            onChange={(e) => setOnlyInvalid(e.target.checked)}
            className="accent-[color:var(--primary)]"
          />
          Only rejected turns
        </label>
      </div>

      {replay.isLoading && (
        <div className="grid place-items-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {replay.error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {(replay.error as Error).message}
        </p>
      )}

      {replay.data && (
        <>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Step {events.length ? cursor + 1 : 0} / {events.length}
              </span>
              <span className="font-mono">{replay.data.match.id.slice(0, 8)}</span>
            </div>
            <div className="mt-3 min-h-[74px] rounded-xl border border-border bg-background/60 p-3">
              {current ? (
                <>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                        KIND_STYLE[current.kind] ?? KIND_STYLE["skip"]
                      }`}
                    >
                      {current.kind}
                    </span>
                    <span className="text-sm font-semibold">{nameOf(current.actor_id)}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">turn {current.turn_no}</span>
                  </div>
                  <p className="mt-2 text-sm">{describe(current)}</p>
                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    {current.valid ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <ShieldCheck className="h-3 w-3" /> server validated
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400">
                        <AlertTriangle className="h-3 w-3" /> {current.rejection}
                      </span>
                    )}
                    {current.server_ms != null && (
                      <span className="text-muted-foreground">· {current.server_ms}ms</span>
                    )}
                    <span className="text-muted-foreground">
                      · {new Date(current.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No events to show.</p>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setCursor((c) => Math.max(0, c - 1))}
                className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background"
                aria-label="Previous step"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPlaying((p) => !p)}
                className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--primary)] text-white"
                aria-label={playing ? "Pause replay" : "Play replay"}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setCursor((c) => Math.min(events.length - 1, c + 1))}
                className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background"
                aria-label="Next step"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setCursor(0);
                  setPlaying(false);
                }}
                className="ml-auto grid h-9 w-9 place-items-center rounded-full border border-border bg-background"
                aria-label="Restart replay"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, events.length - 1)}
              value={cursor}
              onChange={(e) => setCursor(Number(e.target.value))}
              className="mt-3 w-full accent-[color:var(--primary)]"
              aria-label="Replay timeline"
            />
          </div>

          <div className="max-h-[42vh] overflow-y-auto rounded-2xl border border-border bg-card">
            {events.map((e, i) => (
              <button
                key={e.id}
                onClick={() => {
                  setCursor(i);
                  setPlaying(false);
                }}
                className={`flex w-full items-center gap-2 border-b border-border/60 px-3 py-2 text-left text-xs last:border-0 ${
                  i === cursor ? "bg-[color:var(--primary)]/10" : ""
                }`}
              >
                <span className="w-8 font-mono text-muted-foreground">#{e.seq}</span>
                <span
                  className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                    KIND_STYLE[e.kind] ?? KIND_STYLE["skip"]
                  }`}
                >
                  {e.kind}
                </span>
                <span className="truncate">{describe(e)}</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{nameOf(e.actor_id)}</span>
              </button>
            ))}
          </div>

          {adminMode && current && (
            <pre className="overflow-x-auto rounded-2xl border border-border bg-background/70 p-3 text-[10px] text-muted-foreground">
              {JSON.stringify(current, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  );
}
