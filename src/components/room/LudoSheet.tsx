import { useEffect, useMemo, useRef, useState } from "react";
import { X, Trophy, Dice5, Bot, Users, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LudoBoard } from "@/components/room/ludo/LudoBoard";
import { LudoBetModal } from "@/components/room/LudoBetModal";
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

export type LudoPlayer = { id: string; username: string | null; avatar: string | null };
type Step = "mode" | "waiting" | "play";

export function LudoSheet({ open, onClose, players, roomId }: { open: boolean; onClose: () => void; players: LudoPlayer[]; isHost?: boolean; roomId?: string }) {
  const { user, profile } = useAuth();
  const [step, setStep] = useState<Step>("mode");
  const [game, setGame] = useState<LudoGameState | null>(null);
  const [rolling, setRolling] = useState(false);
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<LudoMode>("2p");
  const isAuthority = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const gameRef = useRef<LudoGameState | null>(null);
  const matchIdRef = useRef<string | null>(null);
  const payoutSettledRef = useRef(false);
  gameRef.current = game;

  const myName = profile?.username ?? "You";
  const balance = Number(profile?.coins ?? 0);

  const resetToClosed = () => {
    setStep("mode");
    setGame(null);
    setBetModalOpen(false);
    matchIdRef.current = null;
    payoutSettledRef.current = false;
    isAuthority.current = false;
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };

  useEffect(() => { if (!open) resetToClosed(); }, [open]);

  useEffect(() => {
    if (!open || !roomId) return;
    const ch = supabase.channel(`ludo-${roomId}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "state" }, ({ payload }) => {
      if (isAuthority.current) return;
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
      handleRemoteAction(payload as { kind: "roll" | "move"; tokenIndex?: number; userId?: string });
    });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") void ch.send({ type: "broadcast", event: "sync-request", payload: {} });
    });
    channelRef.current = ch;
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const t = setTimeout(() => {
      setGame((prev) => {
        if (!prev) return prev;
        if (!prev.awaitingMove) {
          const rolled = applyRoll(prev, rollDice());
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

  useEffect(() => {
    if (!game || game.winnerIndex === null || !matchIdRef.current || payoutSettledRef.current) return;
    const winner = game.players[game.winnerIndex]?.userId;
    if (!winner) return;
    payoutSettledRef.current = true;
    void supabase.rpc("ludo_close_match", { p_match: matchIdRef.current, p_winner: winner, p_status: "finished" }).then(({ error, data }) => {
      if (error) {
        payoutSettledRef.current = false;
        toast.error("Winner payout could not be settled yet.");
        console.error("Ludo payout failed", error);
        return;
      }
      toast.success(`Ludo payout settled: ${Number(data ?? 0).toLocaleString()} coins`);
    });
  }, [game]);

  function broadcastLater(state: LudoGameState) {
    if (!roomId || !channelRef.current) return;
    setTimeout(() => { void channelRef.current?.send({ type: "broadcast", event: "state", payload: { state } }); }, 0);
  }

  function handleRemoteAction(payload: { kind: "roll" | "move"; tokenIndex?: number; userId?: string }) {
    setGame((prev) => {
      if (!prev) return prev;
      const actingIdx = prev.players.findIndex((p) => p.userId === payload.userId);
      if (actingIdx !== prev.turnIndex) return prev;
      let next = prev;
      if (payload.kind === "roll" && !prev.awaitingMove) next = applyRoll(prev, rollDice());
      else if (payload.kind === "move" && prev.awaitingMove && typeof payload.tokenIndex === "number") next = applyMove(prev, payload.tokenIndex);
      else return prev;
      broadcastLater(next);
      return next;
    });
  }

  function startSolo(mode: LudoMode) {
    const colors = activeColorsForMode(mode);
    const seats = colors.map((color, i) => ({ color, kind: (i === 0 ? "human" : "bot") as SeatKind, userId: i === 0 ? user?.id : undefined, name: i === 0 ? myName : `Computer ${i}` }));
    isAuthority.current = true;
    matchIdRef.current = null;
    setGame(createGame(mode, seats));
    setStep("play");
  }

  function openBetModal(mode: LudoMode) {
    if (!roomId) { toast.error("Betting needs an active room"); return; }
    const required = activeColorsForMode(mode).length;
    const seatedHumans = players.filter((p) => !p.id.startsWith("empty-") && p.id !== "").slice(0, required);
    if (seatedHumans.length < required) {
      toast.error(`This ${required}-player wager needs ${required} seated players.`);
      return;
    }
    setPendingMode(mode);
    setBetModalOpen(true);
  }

  async function startWithFriends(mode: LudoMode, bet: number) {
    if (!roomId || !user?.id) throw new Error("Active room and signed-in user are required");
    const required = activeColorsForMode(mode).length;
    const seatedHumans = players.filter((p) => !p.id.startsWith("empty-") && p.id !== "").slice(0, required);
    if (seatedHumans.length < required) throw new Error(`This ${required}-player wager needs ${required} seated players.`);
    if (balance < bet) throw new Error("Insufficient coin balance");

    const ids = seatedHumans.map((p) => p.id);
    const { data: matchId, error } = await supabase.rpc("ludo_open_match", { p_room: roomId, p_players: ids, p_bet: bet });
    if (error) throw new Error(error.message || "Unable to fund Ludo match");

    const colors = activeColorsForMode(mode);
    const seats = colors.map((color, i) => ({ color, kind: "human" as SeatKind, userId: ids[i], name: seatedHumans[i]?.username ?? "Player" }));
    isAuthority.current = true;
    matchIdRef.current = matchId as string;
    payoutSettledRef.current = false;
    setBetModalOpen(false);
    const g = createGame(mode, seats);
    setGame(g);
    setStep("play");
    broadcastLater(g);
  }

  function onRoll() {
    if (!game || myPlayerIndex !== game.turnIndex) return;
    if (isAuthority.current) {
      setRolling(true);
      setTimeout(() => { setGame((prev) => { if (!prev) return prev; const next = applyRoll(prev, rollDice()); broadcastLater(next); return next; }); setRolling(false); }, 400);
    } else void channelRef.current?.send({ type: "broadcast", event: "action", payload: { kind: "roll", userId: user?.id } });
  }

  function onPickToken(tokenIndex: number) {
    if (!game || myPlayerIndex !== game.turnIndex || !game.awaitingMove) return;
    if (isAuthority.current) setGame((prev) => { if (!prev) return prev; const next = applyMove(prev, tokenIndex); broadcastLater(next); return next; });
    else void channelRef.current?.send({ type: "broadcast", event: "action", payload: { kind: "move", tokenIndex, userId: user?.id } });
  }

  const exit = () => {
    if (typeof window !== "undefined" && window.parent !== window) window.parent.postMessage({ type: "jalwa:ludo-exit" }, "*");
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div data-jalwa-overlay="true" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={exit} />
      <div data-jalwa-overlay-content="true" className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t border-border bg-card p-5 shadow-2xl" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)", maxHeight: "88vh", overflowY: "auto" }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold"><Dice5 className="h-5 w-5 text-[color:var(--primary)]" /> Ludo Battle</h2>
          <button onClick={exit} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full border border-border bg-background/60"><X className="h-4 w-4" /></button>
        </div>

        {step === "mode" && <ModePicker onPickSolo={startSolo} onPickFriends={openBetModal} />}
        {step === "waiting" && <div className="grid place-items-center gap-3 py-10"><Loader2 className="h-6 w-6 animate-spin text-[color:var(--gold)]" /><p className="text-xs text-muted-foreground">Waiting for the match to start…</p><button onClick={() => setStep("mode")} className="text-xs text-muted-foreground underline">Back</button></div>}
        {step === "play" && game && <div>
          <button onClick={() => setStep("mode")} className="mb-2 flex items-center gap-1 text-[11px] text-muted-foreground"><ArrowLeft className="h-3 w-3" /> New match</button>
          <LudoBoard state={game} myPlayerIndex={myPlayerIndex} rolling={rolling} onRoll={onRoll} onPickToken={onPickToken} />
          {game.winnerIndex !== null && <div className="mt-3 rounded-2xl border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 p-3 text-center"><Trophy className="mx-auto mb-1 h-5 w-5 text-[color:var(--gold)]" /><p className="text-sm font-black">{game.mode === "2v2" ? `Team ${game.winningTeam} wins!` : `${game.players[game.winnerIndex].name ?? game.players[game.winnerIndex].color} wins!`}</p></div>}
        </div>}
      </div>
      <LudoBetModal open={betModalOpen} balance={balance} onClose={() => setBetModalOpen(false)} onConfirm={(value) => startWithFriends(pendingMode, value)} />
    </>
  );
}

const LUDO_MODES: { mode: LudoMode; label: string; hint: string }[] = [
  { mode: "2p", label: "1 v 1", hint: "2 players" },
  { mode: "4p", label: "1 v 3", hint: "4 players" },
  { mode: "2v2", label: "2 v 2", hint: "teams" },
];

function ModePicker({ onPickSolo, onPickFriends }: { onPickSolo: (mode: LudoMode) => void; onPickFriends: (mode: LudoMode) => void }) {
  const [mode, setMode] = useState<LudoMode>("2p");
  return <div className="space-y-4">
    <div><p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Mode</p><div className="grid grid-cols-3 gap-2">{LUDO_MODES.map((m) => <button key={m.mode} onClick={() => setMode(m.mode)} className={`rounded-2xl border px-2 py-3 text-center transition active:scale-95 ${m.mode === mode ? "border-[color:var(--primary)] bg-[color:var(--primary)]/15" : "border-border bg-background/50"}`}><p className="text-sm font-black">{m.label}</p><p className="text-[10px] text-muted-foreground">{m.hint}</p></button>)}</div></div>
    <div className="rounded-2xl border border-border bg-background/40 p-3 text-xs text-muted-foreground">Room betting charges every seated human player atomically. The complete funded pool is paid to the verified winner.</div>
    <div className="grid grid-cols-2 gap-2">
      <button onClick={() => onPickSolo(mode)} className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-background/60 py-3 text-sm font-black active:scale-95"><Bot className="h-4 w-4" /> Practice</button>
      <button onClick={() => onPickFriends(mode)} className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] py-3 text-sm font-black text-primary-foreground active:scale-95"><Users className="h-4 w-4" /> Bet & Play</button>
    </div>
  </div>;
}
