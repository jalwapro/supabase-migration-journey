import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Dice1,
  Dice2,
  Dice3,
  Dice4,
  Dice5,
  Dice6,
  Gift,
  Loader2,
  Mic,
  Smile,
  Volume2,
  Zap,
  ShieldCheck,
  RotateCcw,
  Bot
} from "lucide-react";
import {
  COLOR_HEX,
  GRID_SIZE,
  isSafeRingIndex,
  ringCellCoord,
  tokenCoord,
  type LudoColor,
  type LudoGameState,
} from "@/lib/ludoEngine";

const DICE_ICONS = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

type AvatarMap = Record<string, string | null | undefined>;

const HOME_CLASS: Record<LudoColor, string> = {
  red: "left-0 top-0",
  blue: "right-0 top-0",
  green: "left-0 bottom-0",
  yellow: "right-0 bottom-0",
};

const HOME_BG: Record<LudoColor, string> = {
  red: "from-red-600/90 via-red-900/80 to-black/90",
  blue: "from-blue-500/90 via-blue-900/80 to-black/90",
  green: "from-emerald-500/90 via-emerald-900/80 to-black/90",
  yellow: "from-amber-400/90 via-orange-700/80 to-black/90",
};

const TOKEN_RING: Record<LudoColor, string> = {
  red: "shadow-[0_0_16px_rgba(239,68,68,0.8)] border-red-300",
  blue: "shadow-[0_0_16px_rgba(59,130,246,0.8)] border-blue-300",
  green: "shadow-[0_0_16px_rgba(34,197,94,0.8)] border-emerald-300",
  yellow: "shadow-[0_0_16px_rgba(234,179,8,0.8)] border-amber-300",
};

export function LudoBoard({
  state,
  myPlayerIndex,
  rolling,
  onRoll,
  onPickToken,
  avatarByUserId = {},
}: {
  state: LudoGameState;
  myPlayerIndex: number | null;
  rolling: boolean;
  onRoll: () => void;
  onPickToken: (tokenIndex: number) => void;
  avatarByUserId?: AvatarMap;
}) {
  const myTurn = myPlayerIndex === state.turnIndex;
  const DiceIcon =
    state.dice && state.dice >= 1 && state.dice <= 6
      ? DICE_ICONS[state.dice - 1]
      : Dice5;

  return (
    <div className="w-full max-w-[720px] mx-auto text-white font-mono select-none">
      {/* Top 2 Player Cards */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {state.players.slice(0, 2).map((p, i) => (
          <PlayerCard
            key={p.color}
            player={p}
            active={state.turnIndex === i}
            avatar={p.userId ? avatarByUserId[p.userId] : undefined}
          />
        ))}
      </div>

      {/* Main Ludo Arena Container */}
      <div className="relative mx-auto aspect-square w-full max-w-[620px] overflow-hidden rounded-[28px] border border-cyan-500/40 bg-[#030307] p-2.5 shadow-[0_0_40px_rgba(6,182,212,0.2),inset_0_0_50px_rgba(217,70,239,0.1)]">
        {/* Sci-fi background grid effects */}
        <div className="absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.15),transparent_60%)] pointer-events-none" />
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(6,182,212,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(217,70,239,0.1) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />

        <div
          className="relative grid h-full w-full overflow-hidden rounded-[20px] border border-cyan-500/20 bg-[#080711]"
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
          }}
        >
          {/* Four Glossy Neon Yards */}
          {(["red", "blue", "green", "yellow"] as LudoColor[]).map((color) => {
            const player = state.players.find((p) => p.color === color);
            return (
              <div
                key={`yard-${color}`}
                className={`absolute z-[3] ${HOME_CLASS[color]} h-[42.85%] w-[42.85%] bg-gradient-to-br ${HOME_BG[color]} p-3 backdrop-blur-xl border border-white/10`}
              >
                <div className="flex h-full w-full items-center justify-center rounded-[18px] border border-white/20 bg-black/40 shadow-inner">
                  <div className="grid grid-cols-2 gap-3.5 rounded-[14px] bg-black/60 p-4 border border-white/10 shadow-[inset_0_0_15px_rgba(0,0,0,0.8)]">
                    {[0, 1, 2, 3].map((slot) => {
                      const playerTokens = player?.tokens ?? [];
                      const yardTokens = playerTokens
                        .map((t, idx) => ({ ...t, originalIndex: idx }))
                        .filter((t) => t.d === 0);
                      
                      const tokenObj = yardTokens[slot];
                      const tokenIndex = tokenObj ? tokenObj.originalIndex : -1;

                      const canPick =
                        !!player &&
                        myTurn &&
                        state.awaitingMove &&
                        player.color === color &&
                        tokenIndex >= 0;

                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={!canPick}
                          onClick={() => tokenIndex >= 0 && onPickToken(tokenIndex)}
                          className={`grid h-9 w-9 place-items-center rounded-full border-2 text-[10px] font-black text-white transition-all ${
                            canPick 
                              ? "animate-bounce scale-110 ring-4 ring-white/80 cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.9)]" 
                              : "opacity-70 cursor-not-allowed hover:opacity-90"
                          } ${TOKEN_RING[color]}`}
                          style={{ backgroundColor: COLOR_HEX[color] }}
                        >
                          {tokenObj ? tokenIndex + 1 : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Shared Track Ring */}
          {Array.from({ length: 52 }).map((_, i) => {
            const c = ringCellCoord(i);
            const safe = isSafeRingIndex(i);
            return (
              <div
                key={`ring-${i}`}
                className={`z-[1] border border-white/10 transition-colors ${
                  safe
                    ? "bg-cyan-950/70 shadow-[inset_0_0_10px_rgba(6,182,212,0.6)] border-cyan-400/50"
                    : "bg-[#11101d]/90 hover:bg-[#1a182d]"
                }`}
                style={{ gridRow: c.row + 1, gridColumn: c.col + 1 }}
              >
                {safe && (
                  <div className="grid h-full w-full place-items-center text-[11px] font-black text-cyan-300 animate-pulse">
                    ★
                  </div>
                )}
              </div>
            );
          })}

          {/* Home-Stretch Glowing Lanes */}
          {(["red", "blue", "yellow", "green"] as LudoColor[]).map((color) => {
            const coords =
              color === "red"
                ? [5, 4, 3, 2, 1, 0].map((col) => ({ row: 7, col }))
                : color === "blue"
                  ? [5, 4, 3, 2, 1, 0].map((row) => ({ row, col: 7 }))
                  : color === "yellow"
                    ? [8, 9, 10, 11, 12, 13].map((col) => ({ row: 6, col }))
                    : [8, 9, 10, 11, 12, 13].map((row) => ({ row, col: 6 }));

            return coords.map((c, i) => (
              <div
                key={`${color}-lane-${i}`}
                className="z-[2] border border-white/20 shadow-inner"
                style={{
                  gridRow: c.row + 1,
                  gridColumn: c.col + 1,
                  backgroundColor: `${COLOR_HEX[color]}bb`,
                  boxShadow: `inset 0 0 8px ${COLOR_HEX[color]}`
                }}
              />
            ));
          })}

          {/* Center Four-Color Cyberpunk Finish Zone */}
          <div className="absolute left-[42.85%] top-[42.85%] z-[4] h-[14.3%] w-[14.3%] overflow-hidden shadow-[0_0_25px_rgba(255,255,255,0.3)]">
            <div className="absolute inset-0 bg-red-600" style={{ clipPath: "polygon(0 0,100% 0,50% 50%)" }} />
            <div className="absolute inset-0 bg-blue-600" style={{ clipPath: "polygon(100% 0,100% 100%,50% 50%)" }} />
            <div className="absolute inset-0 bg-amber-500" style={{ clipPath: "polygon(100% 100%,0 100%,50% 50%)" }} />
            <div className="absolute inset-0 bg-emerald-600" style={{ clipPath: "polygon(0 100%,0 0,50% 50%)" }} />
            <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_20px_white] animate-ping" />
            <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_10px_cyan]" />
          </div>

          {/* Active Board Tokens */}
          {state.players.flatMap((p, pIdx) =>
            p.tokens.map((t, tIdx) => {
              const coord = tokenCoord(p.color, t.d);
              if (!coord) return null;
              const canPick =
                myTurn &&
                myPlayerIndex === pIdx &&
                state.awaitingMove;

              return (
                <button
                  key={`${p.color}-${tIdx}`}
                  type="button"
                  disabled={!canPick}
                  onClick={() => onPickToken(tIdx)}
                  className={`z-[20] grid place-items-center rounded-full border-2 border-white text-[10px] font-black text-white transition-all ${
                    canPick
                      ? "cursor-pointer animate-pulse scale-125 ring-4 ring-cyan-300 shadow-[0_0_25px_rgba(6,182,212,1)]"
                      : "cursor-default hover:scale-105"
                  } ${TOKEN_RING[p.color]}`}
                  style={{
                    gridRow: coord.row + 1,
                    gridColumn: coord.col + 1,
                    margin: "2px",
                    background: `linear-gradient(135deg, ${COLOR_HEX[p.color]}, #000)`,
                  }}
                >
                  {tIdx + 1}
                </button>
              );
            }),
          )}
        </div>
      </div>

      {/* Bottom 2 Player Cards */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        {state.players.slice(2, 4).map((p, i) => (
          <PlayerCard
            key={p.color}
            player={p}
            active={state.turnIndex === i + 2}
            avatar={p.userId ? avatarByUserId[p.userId] : undefined}
          />
        ))}
      </div>

      {/* Control Deck (Undo, Animated Dice Roll, Auto-Move) */}
      <div className="mt-3.5 flex items-center justify-between gap-3 rounded-2xl border border-cyan-500/30 bg-black/60 p-3 backdrop-blur-xl shadow-[0_0_25px_rgba(0,0,0,0.6)]">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold transition-all hover:bg-white/10 hover:border-cyan-400/50"
        >
          <RotateCcw className="h-3.5 w-3.5 text-cyan-400" /> Undo
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={onRoll}
            disabled={!myTurn || state.awaitingMove || rolling || !!state.winnerIndex}
            className="relative group grid h-20 w-20 place-items-center rounded-full border-2 border-cyan-400 bg-gradient-to-br from-cyan-400 via-purple-600 to-fuchsia-600 text-white shadow-[0_0_30px_rgba(168,85,247,0.8)] transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Roll dice"
          >
            <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            {rolling ? (
              <Loader2 className="h-9 w-9 animate-spin text-white drop-shadow-[0_0_10px_white]" />
            ) : (
              <DiceIcon className="h-10 w-10 drop-shadow-[0_0_12px_rgba(255,255,255,0.9)] animate-pulse" />
            )}
          </button>
          <p className="mt-1.5 text-[11px] font-bold tracking-wider text-cyan-300 uppercase">
            {state.awaitingMove ? "⚡ Pick a Token" : myTurn ? "🎲 Tap to Roll" : "⏳ Opponent's Turn"}
          </p>
        </div>

        <button
          type="button"
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold transition-all hover:bg-white/10 hover:border-fuchsia-400/50"
        >
          <Bot className="h-4 w-4 text-fuchsia-400" /> Auto Move
        </button>
      </div>

      {/* Voice & Action Toolbar */}
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-cyan-500/20 bg-[#06050e]/95 p-3 shadow-[0_0_20px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <div className="flex-1">
          <p className="text-xs font-black flex items-center gap-1.5 text-cyan-300">
            <Zap className="h-3.5 w-3.5 text-emerald-400 animate-pulse" /> VOICE STREAM <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded text-[9px]">ACTIVE</span>
          </p>
          <p className="text-[10px] text-cyan-100/60 mt-0.5">Secure audio channel connected</p>
        </div>
        <button className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-400/40 bg-emerald-500/10 text-emerald-300 transition hover:bg-emerald-500/20 hover:shadow-[0_0_12px_rgba(16,185,129,0.3)]">
          <Mic className="h-5 w-5" />
        </button>
        <button className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-400/40 bg-cyan-500/10 text-cyan-300 transition hover:bg-cyan-500/20 hover:shadow-[0_0_12px_rgba(6,182,212,0.3)]">
          <Volume2 className="h-5 w-5" />
        </button>
        <button className="flex h-10 items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3.5 text-xs font-bold text-amber-300 transition hover:bg-amber-500/20">
          <Smile className="h-4 w-4" /> Emoji
        </button>
        <button className="flex h-10 items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 text-xs font-bold text-rose-300 transition hover:bg-rose-500/20">
          Exit
        </button>
      </div>
    </div>
  );
}

function PlayerCard({
  player,
  active,
  avatar,
}: {
  player: LudoGameState["players"][number];
  active: boolean;
  avatar?: string | null;
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-3 rounded-2xl border p-2.5 backdrop-blur-xl transition-all ${
        active 
          ? "border-cyan-400 bg-cyan-950/30 shadow-[0_0_20px_rgba(6,182,212,0.25)]" 
          : "border-white/10 bg-black/40 hover:border-white/20"
      }`}
      style={{ borderColor: active ? COLOR_HEX[player.color] : undefined }}
    >
      {avatar ? (
        <img
          src={avatar}
          alt=""
          className="h-11 w-11 shrink-0 rounded-full border-2 object-cover shadow-[0_0_10px_rgba(255,255,255,0.3)]"
          style={{ borderColor: COLOR_HEX[player.color] }}
        />
      ) : (
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 text-sm font-black shadow-md"
          style={{ borderColor: COLOR_HEX[player.color], backgroundColor: `${COLOR_HEX[player.color]}44` }}
        >
          {(player.name ?? player.color).slice(0, 1).toUpperCase()}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-black tracking-wide text-white">{player.name ?? player.color}</p>
        <p className="text-[10px] font-mono text-cyan-300/80 mt-0.5">🪙 {player.tokens.filter((t) => t.d === 58).length * 1000 + 7200}</p>
      </div>

      <button 
        type="button" 
        className="rounded-xl border border-white/10 bg-white/5 p-2 transition hover:bg-white/10"
        title="Send Gift"
      >
        <Gift className="h-4 w-4 shrink-0 transition-transform hover:scale-110" style={{ color: COLOR_HEX[player.color] }} />
      </button>
    </div>
  );
}
