import { useEffect, useMemo, useRef, useState } from "react";
import { X, Coins, Trophy, Dice5, Bot, Users, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LudoBoard } from "@/components/room/ludo/LudoBoard";
import {
  COLOR_ORDER,
  activeColorsForMode,
  applyMove,
  applyRoll,
  botChooseToken,
  createGame,
  rollDice,
  type LudoColor,
  type LudoGameState,
  type LudoMode,
  type SeatKind,
} from "@/lib/ludoEngine";

export type LudoPlayer = {
  id: string;
  username: string | null;
  avatar: string | null;
};

type Step = "mode" | "waiting" | "play";

export function LudoSheet({
  open,
  onClose,
  players,
  roomId,
}: {
  open: boolean;
  onClose: () => void;
  players: LudoPlayer[];
  /** isHost kept optional for backwards compatibility — no longer required
   *  to start a match (see note in the mode-picker below). */
  isHost?: boolean;
  roomId?: string;
}) {
  const { user, profile } = useAuth();
  const [bet, setBet] = useState(100);
  const [step, setStep] = useState<Step>("mode");
  const [game, setGame] = useState<LudoGameState | null>(null);
  const [rolling, setRolling] = useState(false);
  const [pendingMode, setPendingMode] = useState<LudoMode | null>(null);

  // true on the device that is actually running the simulation (the one
  // who started a solo game, or the one who started a friends match).
  // Everyone else only sends action requests and mirrors broadcast state.
  const isAuthority = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const gameRef = useRef<LudoGameState | null>(null);
  gameRef.current = game;

  const myName = profile?.username ?? "You";

  const resetToClosed = () => {
    setStep("mode");
    setGame(null);
    isAuthority.current = false;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) resetToClosed();
  }, [open]);

  // ---------------------------------------------------------------------
  // Realtime sync (only used for "Play with Friends" — solo vs computer
  // never touches the network).
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!open || !roomId) return;
    const ch = supabase.channel(`ludo-${roomId}`, { config: { broadcast: { self: false } } });

    ch.on("broadcast", { event: "state" }, ({ payload }) => {
      if (isAuthority.current) return; // I'm the source of truth, ignore echoes
      const incoming = payload?.state as LudoGameState | undefined;
      if (!incoming) return;
      setGame(incoming);
      setStep("play");
    });

    ch.on("broadcast", { event: "sync-request" }, () => {
      if (!isAuthority.current || !gameRef.current) return;
      void ch.send({ type: "broadcast", event: "state", payload: { state: gameRef.current } });
    });

    ch.on("broadcast", { event: "action" }, ({ payload }) => {
      if (!isAuthority.current || !gameRef.current) return;
      handleRemoteAction(
        payload as { kind: "roll" | "move"; tokenIndex?: number; userId?: string },
      );
    });

    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void ch.send({ type: "broadcast", event: "sync-request", payload: {} });
      }
    });

    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roomId]);

  const myPlayerIndex = useMemo(() => {
    if (!game) return null;
    if (!roomId) return 0; // solo mode — human is always seat 0
    const idx = game.players.findIndex((p) => p.userId === user?.id);
    return idx >= 0 ? idx : null;
  }, [game, roomId, user?.id]);

  // ---------------------------------------------------------------------
  // Bot auto-play — runs only on the authority device.
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!isAuthority.current || !game || game.winnerIndex !== null) return;
    const current = game.players[game.turnIndex];
    if (current.kind !== "bot") return;

    const t = setTimeout(() => {
      setGame((prev) => {
        if (!prev) return prev;
        if (!prev.awaitingMove) {
          const dice = rollDice();
          const rolled = applyRoll(prev, dice);
          broadcastLater(rolled);
          return rolled;
        }
        const tokenIdx = botChooseToken(prev, prev.turnIndex, prev.dice ?? 0);
        if (tokenIdx === null) return prev;
        const moved = applyMove(prev, tokenIdx);
        broadcastLater(moved);
        return moved;
      });
    }, 650);
    return () => clearTimeout(t);
  }, [game]);

  function broadcastLater(state: LudoGameState) {
    if (!roomId || !channelRef.current) return;
    setTimeout(() => {
      void channelRef.current?.send({ type: "broadcast", event: "state", payload: { state } });
    }, 0);
  }

  function handleRemoteAction(payload: {
    kind: "roll" | "move";
    tokenIndex?: number;
    userId?: string;
  }) {
    setGame((prev) => {
      if (!prev) return prev;
      const actingIdx = prev.players.findIndex((p) => p.userId === payload.userId);
      if (actingIdx !== prev.turnIndex) return prev; // not their turn — ignore
      let next = prev;
      if (payload.kind === "roll" && !prev.awaitingMove) {
        next = applyRoll(prev, rollDice());
      } else if (
        payload.kind === "move" &&
        prev.awaitingMove &&
        typeof payload.tokenIndex === "number"
      ) {
        next = applyMove(prev, payload.tokenIndex);
      } else {
        return prev;
      }
      broadcastLater(next);
      return next;
    });
  }

  // ---------------------------------------------------------------------
  // Starting a match
  // ---------------------------------------------------------------------
  function startSolo(mode: LudoMode) {
    const colors = activeColorsForMode(mode);
    const seats = colors.map((color, i) => ({
      color,
      kind: (i === 0 ? "human" : "bot") as SeatKind,
      userId: i === 0 ? user?.id : undefined,
      name: i === 0 ? myName : `Computer ${i}`,
    }));
    isAuthority.current = true;
    setGame(createGame(mode, seats));
    setStep("play");
  }

  function startWithFriends(mode: LudoMode) {
    if (!roomId) {
      toast.error("Friends mode needs an active room");
      return;
    }
    const colors = activeColorsForMode(mode);
    const seatedHumans = players.filter((p) => !p.id.startsWith("empty-"));
    const seats = colors.map((color, i) => {
      const human = seatedHumans[i];
      if (human) {
        return {
          color,
          kind: "human" as SeatKind,
          userId: human.id,
          name: human.username ?? "Player",
        };
      }
      return { color, kind: "bot" as SeatKind, name: `Computer ${i + 1}` };
    });
    isAuthority.current = true;
    const g = createGame(mode, seats);
    setGame(g);
    setStep("play");
    broadcastLater(g);
  }

  function onRoll() {
    if (!game) return;
    const isMe = myPlayerIndex === game.turnIndex;
    if (!isMe) return;
    if (isAuthority.current) {
      setRolling(true);
      setTimeout(() => {
        setGame((prev) => {
          if (!prev) return prev;
          const next = applyRoll(prev, rollDice());
          broadcastLater(next);
          return next;
        });
        setRolling(false);
      }, 400);
    } else {
      void channelRef.current?.send({
        type: "broadcast",
        event: "action",
        payload: { kind: "roll", userId: user?.id },
      });
    }
  }

  function onPickToken(tokenIndex: number) {
    if (!game) return;
    const isMe = myPlayerIndex === game.turnIndex;
    if (!isMe || !game.awaitingMove) return;
    if (isAuthority.current) {
      setGame((prev) => {
        if (!prev) return prev;
        const next = applyMove(prev, tokenIndex);
        broadcastLater(next);
        return next;
      });
    } else {
      void channelRef.current?.send({
        type: "broadcast",
        event: "action",
        payload: { kind: "move", tokenIndex, userId: user?.id },
      });
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        data-jalwa-overlay="true"
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        data-jalwa-overlay-content="true"
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t border-border bg-card p-5 shadow-2xl"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)",
          maxHeight: "88vh",
          overflowY: "auto",
        }}
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

        {step === "mode" && (
          <ModePicker
            bet={bet}
            setBet={setBet}
            onPickSolo={(mode) => {
              setPendingMode(mode);
              startSolo(mode);
            }}
            onPickFriends={(mode) => {
              setPendingMode(mode);
              startWithFriends(mode);
            }}
          />
        )}

        {step === "waiting" && (
          <div className="grid place-items-center gap-3 py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[color:var(--gold)]" />
            <p className="text-xs text-muted-foreground">Waiting for the match to start…</p>
            <button
              onClick={() => setStep("mode")}
              className="text-xs text-muted-foreground underline"
            >
              Back
            </button>
          </div>
        )}

        {step === "play" && game && (
          <div>
            <button
              onClick={() => setStep("mode")}
              className="mb-2 flex items-center gap-1 text-[11px] text-muted-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> New match
            </button>
            <LudoBoard
              state={game}
              myPlayerIndex={myPlayerIndex}
              rolling={rolling}
              onRoll={onRoll}
              onPickToken={onPickToken}
            />
            {game.winnerIndex !== null && (
              <div className="mt-3 rounded-2xl border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 p-3 text-center">
                <Trophy className="mx-auto mb-1 h-5 w-5 text-[color:var(--gold)]" />
                <p className="text-sm font-black">
                  {game.mode === "2v2"
                    ? `Team ${game.winningTeam} wins!`
                    : `${game.players[game.winnerIndex].name ?? game.players[game.winnerIndex].color} wins!`}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function ModePicker({
  bet,
  setBet,
  onPickSolo,
  onPickFriends,
}: {
  bet: number;
  setBet: (n: number) => void;
  onPickSolo: (mode: LudoMode) => void;
  onPickFriends: (mode: LudoMode) => void;
}) {
  return (
    <div>
      {/* Bet */}
      <div className="rounded-2xl border border-border bg-background/60 p-3">
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
      </div>

      <p className="mt-4 mb-2 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
        <Bot className="h-3.5 w-3.5" /> Solo — vs computer
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onPickSolo("2p")}
          className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition-transform active:scale-[0.97]"
        >
          <p className="text-sm font-black">1 vs Computer</p>
          <p className="text-[10px] text-muted-foreground">2 players</p>
        </button>
        <button
          onClick={() => onPickSolo("4p")}
          className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition-transform active:scale-[0.97]"
        >
          <p className="text-sm font-black">vs 3 Computers</p>
          <p className="text-[10px] text-muted-foreground">4 players</p>
        </button>
      </div>

      <p className="mt-4 mb-2 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
        <Users className="h-3.5 w-3.5" /> Play with friends in this room
      </p>
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => onPickFriends("2p")}
          className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition-transform active:scale-[0.97]"
        >
          <p className="text-sm font-black">1v1</p>
          <p className="text-[10px] text-muted-foreground">2 seats</p>
        </button>
        <button
          onClick={() => onPickFriends("4p")}
          className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition-transform active:scale-[0.97]"
        >
          <p className="text-sm font-black">Free-for-all</p>
          <p className="text-[10px] text-muted-foreground">4 seats</p>
        </button>
        <button
          onClick={() => onPickFriends("2v2")}
          className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition-transform active:scale-[0.97]"
        >
          <p className="text-sm font-black">2v2 Teams</p>
          <p className="text-[10px] text-muted-foreground">4 seats</p>
        </button>
      </div>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        Empty seats are automatically filled by the computer.
      </p>
    </div>
  );
}
