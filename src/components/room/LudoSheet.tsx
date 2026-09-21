import { useEffect, useMemo, useRef, useState } from "react";
import { X, Dice5, Bot, Users, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LudoBoard } from "@/components/room/ludo/LudoBoard";
import { LudoBetModal } from "@/components/room/LudoBetModal";
import { activeColorsForMode, applyMove, applyRoll, botChooseToken, createGame, rollDice, type LudoGameState, type LudoMode, type SeatKind } from "@/lib/ludoEngine";

export type LudoPlayer = { id: string; username: string | null; avatar: string | null };
type Step = "mode" | "waiting" | "play";
type RevisionedState = { state: LudoGameState; revision: number };
type ServerLudoState = {
  mode?: LudoMode;
  turnIndex?: number;
  dice?: number | null;
  consecutiveSixes?: number;
  awaitingMove?: boolean;
  winnerIndex?: number | null;
  winnerId?: string | null;
  winningTeam?: "A" | "B" | null;
  players?: Array<{ userId?: string; color?: string; tokens?: number[] }>;
};

export function LudoSheet({ open, onClose, players, roomId }: { open: boolean; onClose: () => void; players: LudoPlayer[]; isHost?: boolean; roomId?: string }) {
  const { user, profile } = useAuth();
  const [step, setStep] = useState<Step>("mode");
  const [game, setGame] = useState<LudoGameState | null>(null);
  const [rolling, setRolling] = useState(false);
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<LudoMode>("2p");
  const [activeBet, setActiveBet] = useState(0);
  const isAuthority = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const gameRef = useRef<LudoGameState | null>(null);
  const matchIdRef = useRef<string | null>(null);
  const payoutSettledRef = useRef(false);
  const revisionRef = useRef(0);
  const lastRemoteRevisionRef = useRef(0);
  gameRef.current = game;

  const myName = profile?.username ?? "You";
  const balance = Number(profile?.coins ?? 0);
  const practiceKey = `jalwa:ludo:practice:${roomId ?? "solo"}:${user?.id ?? "guest"}`;

  const hydrateServerState = (raw: ServerLudoState, matchId: string, bet: number): LudoGameState | null => {
    const rows = Array.isArray(raw.players) ? raw.players : [];
    if (!rows.length) return null;
    const mode = raw.mode === "2v2" ? "2v2" : rows.length === 2 ? "2p" : "4p";
    const colors = activeColorsForMode(mode);
    const hydrated = colors.map((color, i) => {
      const row = rows[i];
      const seated = players.find(p => p.id === row?.userId);
      return {
        color,
        kind: "human" as SeatKind,
        userId: row?.userId,
        name: seated?.username ?? (row?.userId === user?.id ? myName : "Player"),
        avatar: seated?.avatar ?? (row?.userId === user?.id ? (profile?.avatar_url ?? null) : null),
        tokens: (Array.isArray(row?.tokens) ? row.tokens : [0,0,0,0]).slice(0, 4).map(d => ({ d: Number(d) || 0 })),
      };
    });
    matchIdRef.current = matchId;
    setActiveBet(bet);
    return {
      mode,
      players: hydrated,
      turnIndex: Number(raw.turnIndex ?? 0),
      dice: raw.dice == null ? null : Number(raw.dice),
      consecutiveSixes: Number(raw.consecutiveSixes ?? 0),
      awaitingMove: Boolean(raw.awaitingMove),
      log: [],
      winnerIndex: raw.winnerIndex == null ? null : Number(raw.winnerIndex),
      winningTeam: raw.winningTeam ?? null,
      teamOf: mode === "2v2" ? { red: "A", yellow: "A", green: "B", blue: "B" } : undefined,
    };
  };

  const restoreGame = async () => {
    if (!open || !user?.id) return;
    if (roomId) {
      const { data } = await supabase
        .from("ludo_matches")
        .select("id, bet_coins, server_state")
        .eq("room_id", roomId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.id && data.server_state) {
        const restored = hydrateServerState(data.server_state as ServerLudoState, data.id, Number(data.bet_coins ?? 0));
        if (restored) {
          isAuthority.current = true;
          setGame(restored);
          setStep("play");
          return;
        }
      }
    }
    try {
      const saved = localStorage.getItem(practiceKey);
      if (saved) {
        const parsed = JSON.parse(saved) as LudoGameState;
        if (parsed?.players?.length && parsed.players.some(p => p.userId === user.id)) {
          matchIdRef.current = null;
          setActiveBet(0);
          isAuthority.current = true;
          setGame(parsed);
          setStep("play");
        }
      }
    } catch {}
  };

  useEffect(() => { void restoreGame(); }, [open, roomId, user?.id]);

  const resetToClosed = () => {
    setStep("mode"); setGame(null); setBetModalOpen(false); setActiveBet(0); matchIdRef.current = null; payoutSettledRef.current = false; isAuthority.current = false;
    revisionRef.current = 0; lastRemoteRevisionRef.current = 0;
    if (channelRef.current) { void supabase.removeChannel(channelRef.current); channelRef.current = null; }
  };
  useEffect(() => { if (!open) resetToClosed(); }, [open]);

  useEffect(() => {
    if (!open || !roomId) return;
    const ch = supabase.channel(`ludo-${roomId}`, { config: { broadcast: { self: false, ack: true } } });
    ch.on("broadcast", { event: "state" }, ({ payload }) => {
      const packet = payload as RevisionedState | undefined;
      const incoming = packet?.state;
      const revision = Number(packet?.revision);
      if (!incoming || !Number.isFinite(revision) || revision <= lastRemoteRevisionRef.current) return;
      lastRemoteRevisionRef.current = revision; revisionRef.current = revision; setGame(incoming); setStep("play");
    });
    ch.on("broadcast", { event: "sync-request" }, () => {
      if (!gameRef.current) return;
      void ch.send({ type: "broadcast", event: "state", payload: { state: gameRef.current, revision: revisionRef.current } });
    });
    ch.subscribe((status) => { if (status === "SUBSCRIBED") void ch.send({ type: "broadcast", event: "sync-request", payload: {} }); });
    channelRef.current = ch;
    return () => { void supabase.removeChannel(ch); channelRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roomId]);

  const myPlayerIndex = useMemo(() => {
    if (!game) return null;
    if (!roomId) return 0;
    const idx = game.players.findIndex((p) => p.userId === user?.id);
    return idx >= 0 ? idx : null;
  }, [game, roomId, user?.id]);

  function broadcastLater(state: LudoGameState, bump = true) {
    if (!roomId || !channelRef.current) return;
    if (bump) revisionRef.current += 1;
    const revision = revisionRef.current;
    setTimeout(() => { void channelRef.current?.send({ type: "broadcast", event: "state", payload: { state, revision } }); }, 0);
  }

  async function serverRoll(state: LudoGameState): Promise<number | null> {
    if (!matchIdRef.current) return rollDice();
    const { data, error } = await supabase.rpc("ludo_server_roll", { p_match: matchIdRef.current, p_turn: state.turnIndex });
    if (error) { toast.error(error.message || "Server roll failed"); return null; }
    const dice = Number((data as { dice?: number })?.dice);
    return Number.isInteger(dice) && dice >= 1 && dice <= 6 ? dice : null;
  }

  async function serverMove(state: LudoGameState, tokenIndex: number): Promise<boolean> {
    if (!matchIdRef.current) return true;
    const { error } = await supabase.rpc("ludo_server_move", { p_match: matchIdRef.current, p_turn: state.turnIndex, p_token: tokenIndex });
    if (error) { toast.error(error.message || "Server rejected the move"); return false; }
    return true;
  }

  async function processRoll() {
    const state = gameRef.current;
    if (!state || state.winnerIndex !== null || state.awaitingMove) return;
    setRolling(true);
    const dice = await serverRoll(state);
    if (dice === null) { setRolling(false); return; }
    const next = applyRoll(state, dice); setGame(next); broadcastLater(next); setRolling(false);
  }

  async function processMove(tokenIndex: number) {
    const state = gameRef.current;
    if (!state || state.winnerIndex !== null || !state.awaitingMove) return;
    if (!(await serverMove(state, tokenIndex))) return;
    const next = applyMove(state, tokenIndex); setGame(next); broadcastLater(next);
  }

  useEffect(() => {
    if (!game || game.winnerIndex !== null) return;
    const current = game.players[game.turnIndex];
    if (current?.kind !== "bot") return;
    const t = setTimeout(() => {
      if (!gameRef.current || gameRef.current.winnerIndex !== null) return;
      if (!gameRef.current.awaitingMove) void processRoll();
      else {
        const tokenIdx = botChooseToken(gameRef.current, gameRef.current.turnIndex, gameRef.current.dice ?? 0);
        if (tokenIdx !== null) void processMove(tokenIdx);
      }
    }, 650);
    return () => clearTimeout(t);
  }, [game]);

  useEffect(() => {
    if (!game || game.winnerIndex === null || !matchIdRef.current || payoutSettledRef.current) return;
    const winner = game.players[game.winnerIndex]?.userId;
    if (!winner) return;
    payoutSettledRef.current = true;
    void supabase.rpc("ludo_close_match", { p_match: matchIdRef.current, p_winner: winner, p_status: "finished" }).then(({ error, data }) => {
      if (error) { payoutSettledRef.current = false; toast.error("Winner payout could not be settled yet."); return; }
      toast.success(`Ludo payout settled: ${Number(data ?? 0).toLocaleString()} coins`);
    });
  }, [game]);

  async function handleRemoteAction(payload: { kind: "roll" | "move"; tokenIndex?: number; userId?: string }) {
    const state = gameRef.current;
    if (!state) return;
    const actingIdx = state.players.findIndex((p) => p.userId === payload.userId);
    if (actingIdx !== state.turnIndex) return;
    if (payload.kind === "roll" && !state.awaitingMove) await processRoll();
    else if (payload.kind === "move" && state.awaitingMove && typeof payload.tokenIndex === "number") await processMove(payload.tokenIndex);
  }

  function startSolo(mode: LudoMode) {
    try {
      const saved = localStorage.getItem(practiceKey);
      if (saved) {
        const parsed = JSON.parse(saved) as LudoGameState;
        if (parsed?.mode === mode && parsed.players?.some(p => p.userId === user?.id) && parsed.winnerIndex === null) {
          matchIdRef.current = null; revisionRef.current = 0; lastRemoteRevisionRef.current = 0; setActiveBet(0); setGame(parsed); setStep("play"); isAuthority.current = true; return;
        }
      }
    } catch {}
    const colors = activeColorsForMode(mode);
    const seats = colors.map((color, i) => ({ color, kind: (i === 0 ? "human" : "bot") as SeatKind, userId: i === 0 ? user?.id : undefined, name: i === 0 ? myName : `Computer ${i}`, avatar: i === 0 ? (profile?.avatar_url ?? null) : null }));
    isAuthority.current = true; matchIdRef.current = null; revisionRef.current = 0; lastRemoteRevisionRef.current = 0; setActiveBet(0); setGame(createGame(mode, seats)); setStep("play");
  }

  function openBetModal(mode: LudoMode) {
    if (!roomId) { toast.error("Betting needs an active room"); return; }
    const required = activeColorsForMode(mode).length;
    const seatedHumans = players.filter((p) => !p.id.startsWith("empty-") && p.id !== "").slice(0, required);
    if (seatedHumans.length < required) { toast.error(`This ${required}-player wager needs ${required} seated players.`); return; }
    setPendingMode(mode); setBetModalOpen(true);
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
    isAuthority.current = true; matchIdRef.current = matchId as string; payoutSettledRef.current = false; revisionRef.current = 0; lastRemoteRevisionRef.current = 0; setActiveBet(bet); setBetModalOpen(false);
    const g = createGame(mode, seats); setGame(g); setStep("play"); broadcastLater(g, false);
  }

  function onRoll() {
    const state = gameRef.current;
    if (!state || myPlayerIndex !== state.turnIndex) return;
    void processRoll();
  }

  function onPickToken(tokenIndex: number) {
    const state = gameRef.current;
    if (!state || myPlayerIndex !== state.turnIndex || !state.awaitingMove) return;
    void processMove(tokenIndex);
  }

  useEffect(() => {
    if (!game || matchIdRef.current || typeof window === "undefined") return;
    try { localStorage.setItem(practiceKey, JSON.stringify(game)); } catch {}
  }, [game, practiceKey]);

  const exit = () => { if (typeof window !== "undefined" && window.parent !== window) window.parent.postMessage({ type: "jalwa:ludo-exit" }, "*"); onClose(); };
  if (!open) return null;

  return (
    <>
      <div data-jalwa-overlay="true" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md" onClick={exit} />
      <div data-jalwa-overlay-content="true" className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[500px] overflow-y-auto rounded-t-[30px] border-t border-white/10 bg-[#090811] shadow-[0_-20px_80px_rgba(0,0,0,.65)]" style={{ paddingBottom: "env(safe-area-inset-bottom)", maxHeight: "96vh" }}>
        <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-white/15" />
        {step === "mode" && (
          <div className="p-5">
            <div className="mb-5 flex items-center justify-between">
              <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-300">Jalwa Games</p><h2 className="mt-1 text-xl font-black">Ludo Battle</h2></div>
              <button onClick={exit} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[.05]"><X className="h-4 w-4"/></button>
            </div>
            <ModePicker onPickSolo={startSolo} onPickFriends={openBetModal} />
          </div>
        )}
        {step === "waiting" && <div className="grid place-items-center gap-3 p-12"><Loader2 className="h-7 w-7 animate-spin text-fuchsia-300"/><p className="text-xs text-white/50">Waiting for the match to start…</p><button onClick={() => setStep("mode")} className="text-xs text-white/45 underline">Back</button></div>}
        {step === "play" && game && (
          <div className="p-2">
            <button onClick={() => setStep("mode")} className="mb-1 ml-2 flex items-center gap-1 text-[10px] font-bold text-white/40"><ArrowLeft className="h-3 w-3"/> New match</button>
            <LudoBoard state={game} myPlayerIndex={myPlayerIndex} rolling={rolling} onRoll={onRoll} onPickToken={onPickToken} onExit={exit} userCoins={balance} roomBet={activeBet} />
          </div>
        )}
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
  const selected = LUDO_MODES.find(m => m.mode === mode)!;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {LUDO_MODES.map(m => (
          <button key={m.mode} onClick={() => setMode(m.mode)}
            className={`rounded-2xl border p-3 text-center transition active:scale-[.98] ${m.mode === mode ? "border-fuchsia-400/60 bg-fuchsia-400/10 shadow-[0_0_22px_rgba(217,70,239,.12)]" : "border-white/10 bg-white/[.03]"}`}>
            <p className="text-sm font-black">{m.label}</p><p className="mt-0.5 text-[9px] text-white/40">{m.hint}</p>
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-cyan-400/10 text-xl">🎲</div>
          <div><p className="text-sm font-black">{selected.label} Ludo</p><p className="text-[10px] text-white/45">{selected.hint} • fast rounds • voice room</p></div>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-white/35">Practice is free. Bet & Play uses the selected room wager and pays the verified winner.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => onPickSolo(mode)} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[.04] py-3.5 text-sm font-black transition active:scale-[.98]"><Bot className="h-4 w-4 text-cyan-300"/> Practice</button>
        <button onClick={() => onPickFriends(mode)} className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-600 py-3.5 text-sm font-black text-white shadow-[0_8px_28px_rgba(168,85,247,.25)] transition active:scale-[.98]"><Users className="h-4 w-4"/> Bet & Play</button>
      </div>
    </div>
  );
}
