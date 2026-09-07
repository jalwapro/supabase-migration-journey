import React from "react";
import { Dice5, Gift, Loader2, Mic, Volume2, Smile, X, RotateCcw, Sparkles } from "lucide-react";
import { COLOR_HEX, type LudoGameState } from "@/lib/ludoEngine";

interface JalwaLudoUIWrapperProps {
  state: LudoGameState;
  myPlayerIndex: number | null;
  rolling: boolean;
  onRoll: () => void;
  onExit: () => void;
  userCoins: number;
  roomBet: number;
  children: React.ReactNode;
}

export function JalwaLudoUIWrapper({
  state,
  myPlayerIndex,
  rolling,
  onRoll,
  onExit,
  userCoins,
  roomBet,
  children,
}: JalwaLudoUIWrapperProps) {
  const topPlayers = state.players.slice(0, 2);
  const bottomPlayers = state.players.slice(2, 4);

  return (
    <div className="relative mx-auto flex w-full max-w-[480px] flex-col overflow-hidden rounded-[32px] border border-fuchsia-500/40 bg-[#070314] p-4 text-white shadow-[0_0_50px_rgba(168,85,247,0.3)]">
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 shadow-md">👑</div>
          <h1 className="text-base font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-orange-400 drop-shadow">Jalwa Ludo 🎲</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-black/40 px-3 py-1 shadow-inner">
            <span className="text-sm">🪙</span>
            <span className="text-xs font-extrabold text-amber-300">{userCoins.toLocaleString()}</span>
          </div>
          <button onClick={onExit} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 transition hover:bg-white/20"><X className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="mb-3 text-center">
        <span className="inline-block rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-0.5 text-[11px] font-bold text-amber-300 shadow-[0_0_10px_rgba(234,179,8,0.2)]">Room Bet: 🪙 {roomBet.toLocaleString()}</span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2.5">
        {topPlayers.map((player, index) => <NeonPlayerCard key={player.color} player={player} active={state.turnIndex === index} />)}
      </div>

      <div className="relative rounded-[24px] border border-cyan-400/30 bg-[#0c081e] p-2 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
        {children}
      </div>

      <div className="mt-3 mb-4 grid grid-cols-2 gap-2.5">
        {bottomPlayers.map((player, index) => <NeonPlayerCard key={player.color} player={player} active={state.turnIndex === index + 2} />)}
      </div>

      <div className="mb-4 flex items-center justify-around rounded-2xl border border-white/10 bg-black/40 p-3">
        <button type="button" className="flex flex-col items-center gap-1 text-[10px] font-bold text-white/70 hover:text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5"><RotateCcw className="h-4 w-4" /></span>
          Undo
        </button>
        <div className="flex flex-col items-center">
          <button type="button" onClick={onRoll} disabled={rolling || myPlayerIndex !== state.turnIndex} className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-fuchsia-400/80 bg-gradient-to-br from-white via-slate-100 to-slate-300 text-slate-900 shadow-[0_0_25px_rgba(217,70,239,0.6)] transition-transform active:scale-95 disabled:opacity-50">
            {rolling ? <Loader2 className="h-7 w-7 animate-spin text-purple-600" /> : <Dice5 className="h-8 w-8 text-slate-800" />}
          </button>
          <span className="mt-1 text-[10px] font-bold tracking-wider text-fuchsia-300">Tap to Roll</span>
        </div>
        <button type="button" className="flex flex-col items-center gap-1 text-[10px] font-bold text-white/70 hover:text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5"><Sparkles className="h-4 w-4 text-amber-400" /></span>
          Auto Move
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0d091a] p-2.5 shadow-lg">
        <div className="flex-1">
          <p className="flex items-center gap-1 text-xs font-extrabold">🎙️ Voice <span className="text-emerald-400">Room Active</span></p>
          <p className="text-[10px] text-white/50">You can talk while playing</p>
        </div>
        <button type="button" aria-label="Microphone" className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"><Mic className="h-4 w-4" /></button>
        <button type="button" aria-label="Speaker" className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10 text-cyan-300"><Volume2 className="h-4 w-4" /></button>
        <button type="button" className="flex h-9 items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 text-[11px] font-bold text-amber-300"><Smile className="h-3.5 w-3.5" /> Emoji</button>
        <button type="button" onClick={onExit} className="flex h-9 items-center gap-1 rounded-xl border border-red-500/40 bg-red-500/10 px-2.5 text-[11px] font-bold text-red-300">Exit</button>
      </div>
    </div>
  );
}

function NeonPlayerCard({ player, active }: { player: LudoGameState["players"][number]; active: boolean }) {
  const borderColor = COLOR_HEX[player.color] || "#fff";
  return (
    <div className={`relative flex items-center gap-2 rounded-2xl border p-2 transition-all ${active ? "bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.2)]" : "bg-black/30 border-white/10"}`} style={{ borderColor: active ? borderColor : "rgba(255,255,255,0.1)" }}>
      <div className="relative">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 text-sm font-black text-white shadow-md" style={{ borderColor, backgroundColor: `${borderColor}33` }}>{player.name ? player.name[0].toUpperCase() : player.color[0].toUpperCase()}</div>
        <div className="absolute -bottom-1 -right-1 text-[10px]">📍</div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-black text-white">{player.name ?? player.color}</p>
        <p className="flex items-center gap-0.5 text-[10px] font-bold text-amber-300">🪙 {player.tokens.filter((token) => token.d === 58).length * 1000 + 7200}</p>
      </div>
      <button type="button" aria-label={`Send gift to ${player.name ?? player.color}`} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-pink-400 hover:bg-white/10"><Gift className="h-3.5 w-3.5" /></button>
    </div>
  );
}
