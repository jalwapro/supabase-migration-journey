import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Coins,
  Dice5,
  Gift,
  Loader2,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LudoBoard } from "@/components/room/ludo/LudoBoard";
import {
  activeColorsForMode,
  applyMove,
  applyRoll,
  botChooseToken,
  createGame,
  rollDice,
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
  isHost?: boolean;
  roomId?: string;
}) {
  const { user, profile } = useAuth();
  const [bet, setBet] = useState(500);
  const [step, setStep] = useState<Step>("mode");
  const [game, setGame] = useState<LudoGameState | null>(null);
  const [rolling, setRolling] = useState(false);

  const isAuthority = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const gameRef = useRef<LudoGameState | null>(null);
  gameRef.current = game;

  const myName = profile?.username ?? "You";

  const avatarByUserId = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p.avatar])),
    [players],
  );

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

  useEffect(() => {
    if (!open || !roomId) return;

    const ch = supabase.channel(`ludo-${roomId}`, {
      config: { broadcast: { self: false } },
    });

    ch.on("broadcast", { event: "state" }, ({ payload }) => {
      if (isAuthority.current) return;
      const incoming = payload?.state as LudoGameState | undefined;
      if (!incoming) return;
      setGame(incoming);
      setStep("play");
    });

    ch.on("broadcast", { event: "sync-request" }, () => {
      if (!isAuthority.current || !gameRef.current) return;
      void ch.send({
        type: "broadcast",
        event: "state",
        payload: { state: gameRef.current },
      });
    });

    ch.on("broadcast", { event: "action" }, ({ payload }) => {
      if (!isAuthority.current || !gameRef.current) return;
      handleRemoteAction(payload as { kind: "roll" | "move"; tokenIndex?: number; userId?: string });
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
  }, [open, roomId]);

  const myPlayerIndex = useMemo(() => {
    if (!game) return null;
    if (!roomId) return 0;
    const idx = game.players.findIndex((p) => p.userId === user?.id);
    return idx >= 0 ? idx : null;
  }, [game, roomId, user?.id]);

  useEffect(() => {
    if (!isAuthority.current || !game || game.winnerIndex !== null) return;
    const current = game.players[game.turnIndex];
    if (current.kind !== "bot") return;

    const timer = setTimeout(() => {
      setGame((prev) => {
        if (!prev) return prev;
        if (!prev.awaitingMove) {
          const next = applyRoll(prev, rollDice());
          broadcastLater(next);
          return next;
        }
        const tokenIndex = botChooseToken(prev, prev.turnIndex, prev.dice ?? 0);
        if (tokenIndex === null) return prev;
        const next = applyMove(prev, tokenIndex);
        broadcastLater(next);
        return next;
      });
    }, 650);

    return () => clearTimeout(timer);
  }, [game]);

  function broadcastLater(state: LudoGameState) {
    if (!roomId || !channelRef.current) return;
    setTimeout(() => {
      void channelRef.current?.send({
        type: "broadcast",
        event: "state",
        payload: { state },
      });
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
      if (actingIdx !== prev.turnIndex) return prev;

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
      return {
        color,
        kind: "bot" as SeatKind,
        name: `Computer ${i + 1}`,
      };
    });

    isAuthority.current = true;
    const g = createGame(mode, seats);
    setGame(g);
    setStep("play");
    broadcastLater(g);
  }

  function onRoll() {
    if (!game) return;
    if (myPlayerIndex !== game.turnIndex) return;

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
    if (myPlayerIndex !== game.turnIndex || !game.awaitingMove) return;

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
      {/* Voice room stays visible behind the Ludo game */}
      <div
        data-jalwa-overlay="true"
        className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-[5px]"
        onClick={onClose}
      />

      {/* Centered reference-style popup */}
      <div
        data-jalwa-overlay-content="true"
        className="fixed left-1/2 top-1/2 z-[91] flex w-[92vw] max-w-[840px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border border-cyan-300/60 bg-[#080513]/95 shadow-[0_0_30px_rgba(40,180,255,.28),0_0_80px_rgba(150,50,255,.20)]"
        style={{
          height: "78vh",
          maxHeight: "900px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,.16),transparent_40%)]" />

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/10 px-2 py-1 text-xs font-black leading-none">
                <span className="text-cyan-300">JALWA</span>
                <span className="block text-amber-300">LUDO</span>
              </div>
              <div className="hidden text-xl font-black sm:block">
                🎲 <span className="text-amber-300">Jalwa Ludo</span> 🎲
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-full border border-fuchsia-400/50 bg-black/30 px-3 py-2 text-sm font-extrabold">
                🪙 12,450
              </div>
              <button
                onClick={onClose}
                aria-label="Close Ludo"
                className="grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-white/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5">
            {step === "mode" && (
              <ModePicker
                bet={bet}
                setBet={setBet}
                onPickSolo={startSolo}
                onPickFriends={startWithFriends}
              />
            )}

            {step === "waiting" && (
              <div className="grid place-items-center gap-3 py-16">
                <Loader2 className="h-7 w-7 animate-spin text-amber-300" />
                <p className="text-xs text-white/60">Waiting for the match to start…</p>
                <button
                  onClick={() => setStep("mode")}
                  className="text-xs text-white/50 underline"
                >
                  Back
                </button>
              </div>
            )}

            {step === "play" && game && (
              <div>
                <div className="mb-3 flex items-center justify-center">
                  <div className="rounded-full border border-fuchsia-400/40 bg-black/30 px-4 py-1.5 text-xs font-bold">
                    Room Bet: 🪙 <span className="text-amber-300">{bet}</span>
                  </div>
                </div>

                <LudoBoard
                  state={game}
                  myPlayerIndex={myPlayerIndex}
                  rolling={rolling}
                  onRoll={onRoll}
                  onPickToken={onPickToken}
                  avatarByUserId={avatarByUserId}
                />

                {game.winnerIndex !== null && (
                  <div className="mt-3 rounded-2xl border border-amber-300/50 bg-amber-500/10 p-3 text-center">
                    <Trophy className="mx-auto mb-1 h-6 w-6 text-amber-300" />
                    <p className="text-sm font-black">
                      {game.mode === "2v2"
                        ? `Team ${game.winningTeam} wins!`
                        : `${game.players[game.winnerIndex].name ?? game.players[game.winnerIndex].color} wins!`}
                    </p>
                  </div>
                )}

                <button
                  onClick={() => setStep("mode")}
                  className="mx-auto mt-3 flex items-center gap-1 text-[11px] text-white/50"
                >
                  <ArrowLeft className="h-3 w-3" /> New match
                </button>
              </div>
            )}
          </div>
        </div>
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
    <div className="mx-auto w-full max-w-[680px] py-3">
      <div className="rounded-2xl border border-fuchsia-400/20 bg-black/20 p-4">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-white/60">
            <Coins className="h-4 w-4 text-amber-300" />
            Room bet
          </span>
          <span className="font-black text-amber-300">{bet} coins</span>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {[50, 100, 500, 1000].map((v) => (
            <button
              key={v}
              onClick={() => setBet(v)}
              className={`rounded-full py-2 text-xs font-black ${
                bet === v
                  ? "bg-gradient-to-r from-amber-400 to-fuchsia-500 text-black"
                  : "border border-white/10 bg-white/5"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-2 mt-5 flex items-center gap-1.5 text-[11px] font-bold text-white/55">
        <Bot className="h-4 w-4" /> Solo — vs computer
      </p>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onPickSolo("2p")}
          className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left"
        >
          <p className="text-sm font-black">1 vs Computer</p>
          <p className="mt-1 text-[10px] text-white/50">2 players</p>
        </button>

        <button
          onClick={() => onPickSolo("4p")}
          className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left"
        >
          <p className="text-sm font-black">vs 3 Computers</p>
          <p className="mt-1 text-[10px] text-white/50">4 players</p>
        </button>
      </div>

      <p className="mb-2 mt-5 flex items-center gap-1.5 text-[11px] font-bold text-white/55">
        <Users className="h-4 w-4" /> Play with friends in this room
      </p>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => onPickFriends("2p")}
          className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left"
        >
          <p className="text-sm font-black">1v1</p>
          <p className="mt-1 text-[10px] text-white/50">2 seats</p>
        </button>

        <button
          onClick={() => onPickFriends("4p")}
          className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left"
        >
          <p className="text-sm font-black">Free-for-all</p>
          <p className="mt-1 text-[10px] text-white/50">4 seats</p>
        </button>

        <button
          onClick={() => onPickFriends("2v2")}
          className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left"
        >
          <p className="text-sm font-black">2v2 Teams</p>
          <p className="mt-1 text-[10px] text-white/50">4 seats</p>
        </button>
      </div>

      <p className="mt-3 text-center text-[10px] text-white/40">
        Empty seats are automatically filled by the computer.
      </p>
    </div>
  );
}
