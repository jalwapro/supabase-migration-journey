import {
  Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, Gift, Loader2, Mic,
  Volume2, Smile, RotateCcw, Bot, X, Crown, Coins, Trophy,
  Mic2 } from "lucide-react";
import {
  COLOR_HEX, GRID_SIZE, isSafeRingIndex, ringCellCoord, tokenCoord,
  type LudoColor, type LudoGameState,
} from "@/lib/ludoEngine";

const DICE_ICONS = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

const HOME_CLASS: Record<LudoColor, string> = {
  red: "left-0 top-0",
  green: "right-0 top-0",
  yellow: "right-0 bottom-0",
  blue: "left-0 bottom-0",
};

const HOME_LANES: Record<LudoColor, { row: number; col: number }[]> = {
  red: [1, 2, 3, 4, 5, 6].map((col) => ({ row: 7, col })),
  green: [1, 2, 3, 4, 5, 6].map((row) => ({ row, col: 7 })),
  yellow: [13, 12, 11, 10, 9, 8].map((col) => ({ row: 7, col })),
  blue: [13, 12, 11, 10, 9, 8].map((row) => ({ row, col: 7 })),
};

const HOME_BG: Record<LudoColor, string> = {
  red: "from-red-500/90 via-red-800/85 to-red-950",
  blue: "from-blue-500/90 via-blue-800/85 to-blue-950",
  green: "from-emerald-500/90 via-emerald-800/85 to-emerald-950",
  yellow: "from-amber-300/95 via-orange-600/90 to-amber-900",
};

const TOKEN_RING: Record<LudoColor, string> = {
  red: "border-red-200 shadow-[0_0_14px_rgba(239,68,68,.8)]",
  blue: "border-blue-200 shadow-[0_0_14px_rgba(59,130,246,.8)]",
  green: "border-emerald-200 shadow-[0_0_14px_rgba(34,197,94,.8)]",
  yellow: "border-amber-100 shadow-[0_0_14px_rgba(234,179,8,.8)]",
};

export function LudoBoard({
  state,
  myPlayerIndex,
  rolling,
  onRoll,
  onPickToken,
  onExit,
  userCoins = 0,
  roomBet = 0,
}: {
  state: LudoGameState;
  myPlayerIndex: number | null;
  rolling: boolean;
  onRoll: () => void;
  onPickToken: (tokenIndex: number) => void;
  onExit?: () => void;
  userCoins?: number;
  roomBet?: number;
}) {
  const myTurn = myPlayerIndex === state.turnIndex;
  const DiceIcon = state.dice && state.dice >= 1 && state.dice <= 6
    ? DICE_ICONS[state.dice - 1] : Dice5;
  const activePlayer = state.players[state.turnIndex];
  const topPlayers = state.players.slice(0, 2);
  const bottomPlayers = state.players.slice(2, 4);

  return (
    <div className="relative mx-auto flex min-h-[min(92vh,760px)] w-full max-w-[480px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#070611] p-3 text-white shadow-[0_18px_70px_rgba(0,0,0,.65)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,.20),transparent_35%),radial-gradient(circle_at_0%_100%,rgba(6,182,212,.10),transparent_30%)]" />

      <header className="relative z-10 mb-2 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.045] px-3 py-2 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-300 via-yellow-500 to-orange-600 text-black shadow-[0_0_18px_rgba(245,158,11,.35)]">
            <Crown className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black tracking-wide">Jalwa Ludo</p>
            <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-white/45">
              {state.mode === "2v2" ? "Team Battle" : state.mode === "4p" ? "4 Player Battle" : "Head to Head"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/[.08] px-2.5 py-1">
            <Coins className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-[10px] font-black text-amber-200">{userCoins.toLocaleString()}</span>
          </div>
          {onExit && (
            <button onClick={onExit} className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[.06] text-white/70 transition hover:bg-white/10" aria-label="Close Ludo">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <div className="relative z-10 mb-2 flex items-center justify-between px-1">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[.16em] text-white/35">Match pot</p>
          <p className="text-xs font-black text-amber-300">🪙 {(roomBet * state.players.length).toLocaleString()}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[.04] px-2.5 py-1 text-[9px] font-bold text-white/55">
          {activePlayer ? `${activePlayer.name ?? "Player"}'s turn` : "Waiting"}
        </div>
      </div>

      {state.players.length > 2 && (
        <div className="relative z-10 mb-2 grid grid-cols-2 gap-2">
          {topPlayers.map((p, i) => <PlayerCard key={p.color} player={p} active={state.turnIndex === i} />)}
        </div>
      )}

      <div className="relative z-10 mx-auto w-full max-w-[420px]" style={{ perspective: "1200px" }}>
        <div className="relative aspect-square w-full rounded-[24px] border border-white/10 bg-black/50 p-1.5 shadow-[0_18px_45px_rgba(0,0,0,.55)]" style={{ transform: "rotateX(7deg)", transformStyle: "preserve-3d" }}>
          <div className="absolute inset-x-2 -bottom-2 h-3 rounded-b-[20px] bg-[#171426] shadow-[0_10px_20px_rgba(0,0,0,.65)]" />
          <div className="relative z-[2] grid h-full w-full overflow-hidden rounded-[19px] border border-cyan-300/15 bg-[#090914] shadow-[inset_0_0_28px_rgba(255,255,255,.06),0_8px_18px_rgba(0,0,0,.45)]"
            style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0,1fr))`, gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0,1fr))` }}>
            
            {(["red","blue","green","yellow"] as LudoColor[]).map((color) => {
              const player = state.players.find((p) => p.color === color);
              const yardTokens = player?.tokens.map((t, idx) => ({...t, originalIndex: idx})).filter(t => t.d === 0) ?? [];
              return (
                <div key={`yard-${color}`} className={`absolute z-[3] ${HOME_CLASS[color]} h-[40%] w-[40%] bg-gradient-to-br ${HOME_BG[color]} p-[2.5%]`}>
                  <div className="flex h-full w-full items-center justify-center rounded-[13px] border border-white/20 bg-black/20 shadow-[inset_0_0_20px_rgba(0,0,0,.45)]">
                    <div className="grid grid-cols-2 gap-[8%] rounded-xl border border-white/10 bg-black/25 p-[8%]">
                      {[0,1,2,3].map(slot => {
                        const tokenObj = yardTokens[slot];
                        const tokenIndex = tokenObj?.originalIndex ?? -1;
                        const canPick = !!player && myTurn && state.awaitingMove && player.color === activePlayer?.color && tokenIndex >= 0;
                        return (
                          <button key={slot} type="button" disabled={!canPick} onClick={() => tokenIndex >= 0 && onPickToken(tokenIndex)}
                            className={`grid aspect-square w-[clamp(17px,4.7vw,27px)] place-items-center rounded-full border-2 text-[8px] font-black text-white transition-all ${TOKEN_RING[color]} ${canPick ? "scale-110 animate-pulse ring-2 ring-white/70" : "opacity-80"}`}
                            style={{backgroundColor: COLOR_HEX[color]}}>
                            {tokenObj ? tokenIndex + 1 : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {Array.from({length:52}).map((_, i) => {
              const c = ringCellCoord(i);
              const safe = isSafeRingIndex(i);
              return (
                <div key={`ring-${i}`} className={`z-[1] border border-white/[.07] ${safe ? "bg-cyan-950/70 border-cyan-300/30" : "bg-white/[.025]"}`}
                  style={{gridRow:c.row+1,gridColumn:c.col+1}}>
                  {safe && <div className="grid h-full w-full place-items-center text-[8px] text-cyan-200/80">★</div>}
                </div>
              );
            })}

            {(["red","green","yellow","blue"] as LudoColor[]).flatMap(color =>
              HOME_LANES[color].map((c, i) => (
                <div key={color + "-home-" + i} className="z-[2] border border-white/20"
                  style={{
                    gridRow: c.row + 1,
                    gridColumn: c.col + 1,
                    background: "linear-gradient(135deg," + COLOR_HEX[color] + "d9," + COLOR_HEX[color] + "66)",
                    boxShadow: "inset 0 0 10px " + COLOR_HEX[color] + "66",
                  }}
                />
              ))
            )}

            <div className="absolute left-[40%] top-[40%] z-[4] h-[20%] w-[20%] overflow-hidden rounded-lg border border-white/35 bg-black shadow-[0_0_22px_rgba(255,255,255,.28)]">
              {(["red","green","yellow","blue"] as LudoColor[]).map((color, i) => {
                const player = state.players.find(p => p.color === color);
                const clips = ["polygon(0 0,100% 0,50% 100%)","polygon(100% 0,100% 100%,0 50%)","polygon(100% 100%,0 100%,50% 0)","polygon(0 100%,0 0,100% 50%)"];
                return <div key={color} className="absolute inset-0" style={{backgroundColor:COLOR_HEX[color], clipPath:clips[i], opacity:.92}}>
                  <span className="grid h-full w-full place-items-center pb-1 text-[7px] font-black text-white drop-shadow">{player?.name?.slice(0,1).toUpperCase() ?? color.slice(0,1).toUpperCase()}</span>
                </div>;
              })}
              <div className="absolute left-1/2 top-1/2 grid h-[22%] w-[22%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/50 bg-white/15 text-[7px] font-black text-white">★</div>
            </div>

            {state.players.flatMap((p,pIdx) => p.tokens.map((t,tIdx) => {
              const coord = tokenCoord(p.color,t.d);
              if (!coord) return null;
              const canPick = myTurn && myPlayerIndex === pIdx && state.awaitingMove;
              return <button key={`${p.color}-${tIdx}`} type="button" disabled={!canPick} onClick={() => onPickToken(tIdx)}
                className={`group relative z-[20] min-w-0 rounded-full border-2 border-white transition-all ${canPick ? "scale-125 animate-pulse ring-2 ring-cyan-200" : ""} ${TOKEN_RING[p.color]}`}
                style={{gridRow:coord.row+1,gridColumn:coord.col+1,margin:"3%",aspectRatio:"1",background:`linear-gradient(145deg,${COLOR_HEX[p.color]} 10%,#08080d 85%)`,transform:"translateZ(22px)",boxShadow:`inset 3px 3px 5px rgba(255,255,255,.35),inset -4px -5px 7px rgba(0,0,0,.55),0 8px 10px rgba(0,0,0,.65),0 0 16px ${COLOR_HEX[p.color]}aa`}}>
                <span className="absolute inset-[10%] overflow-hidden rounded-full border border-white/70 bg-black/30 shadow-[inset_0_2px_4px_rgba(255,255,255,.3)]">
                  {p.avatar ? <img src={p.avatar} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-[clamp(7px,1.8vw,11px)] font-black text-white">{(p.name ?? p.color).slice(0,1).toUpperCase()}</span>}
                </span>
                <span className="absolute -top-[48%] left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 bg-black/85 px-1.5 py-0.5 text-[clamp(6px,1.5vw,9px)] font-black text-white shadow-lg">{p.name ?? p.color}</span>
                <span className="absolute -bottom-[10%] -right-[10%] grid h-[30%] w-[30%] min-h-[9px] min-w-[9px] place-items-center rounded-full border border-black/60 bg-emerald-500 text-white shadow-lg"><Mic2 className="h-[65%] w-[65%]" /></span>
                <span className="sr-only">{p.name ?? p.color} token {tIdx+1}</span>
              </button>;
            }))}
          </div>
        </div>
      </div>

      {state.players.length > 2 && (
        <div className="relative z-10 mt-2 grid grid-cols-2 gap-2">
          {bottomPlayers.map((p,i) => <PlayerCard key={p.color} player={p} active={state.turnIndex === i+2} />)}
        </div>
      )}

      {state.players.length <= 2 && (
        <div className="relative z-10 mt-2 grid grid-cols-2 gap-2">
          {topPlayers.map((p,i) => <PlayerCard key={p.color} player={p} active={state.turnIndex === i} />)}
        </div>
      )}

      <div className="relative z-10 mt-2 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.045] px-3 py-2.5 backdrop-blur-xl">
        <button type="button" className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[.05] text-white/50" aria-label="Undo">
          <RotateCcw className="h-4 w-4" />
        </button>
        <div className="flex flex-col items-center">
          <button type="button" onClick={onRoll} disabled={!myTurn || state.awaitingMove || rolling || state.winnerIndex !== null}
            className="grid h-[58px] w-[58px] place-items-center rounded-full border-2 border-fuchsia-300/80 bg-gradient-to-br from-white via-slate-100 to-fuchsia-100 text-slate-900 shadow-[0_0_30px_rgba(217,70,239,.45)] transition active:scale-90 disabled:opacity-35">
            {rolling ? <Loader2 className="h-6 w-6 animate-spin" /> : <DiceIcon className="h-7 w-7" />}
          </button>
          <span className="mt-1 text-[9px] font-black uppercase tracking-wider text-fuchsia-200">
            {state.winnerIndex !== null ? "Winner" : state.awaitingMove ? "Pick token" : myTurn ? "Roll dice" : "Opponent"}
          </span>
        </div>
        <button type="button" className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[.05] text-fuchsia-300" aria-label="Auto move">
          <Bot className="h-4 w-4" />
        </button>
      </div>

      <div className="relative z-10 mt-2 flex items-center gap-2 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.035] px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[10px] font-black"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_7px_#34d399]" /> Voice room active</p>
          <p className="truncate text-[8px] text-white/35">Talk while you play</p>
        </div>
        <button className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-400/20 bg-emerald-400/[.08] text-emerald-300"><Mic className="h-3.5 w-3.5"/></button>
        <button className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-400/[.08] text-cyan-300"><Volume2 className="h-3.5 w-3.5"/></button>
        <button className="grid h-8 w-8 place-items-center rounded-lg border border-amber-400/20 bg-amber-400/[.08] text-amber-300"><Smile className="h-3.5 w-3.5"/></button>
      </div>

      {state.winnerIndex !== null && (
        <div className="relative z-10 mt-2 flex items-center justify-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/[.08] p-2.5 text-center">
          <Trophy className="h-5 w-5 text-amber-300" />
          <p className="text-xs font-black text-amber-100">
            {state.mode === "2v2" ? `Team ${state.winningTeam} wins!` : `${state.players[state.winnerIndex]?.name ?? "Player"} wins!`}
          </p>
        </div>
      )}
    </div>
  );
}

function PlayerCard({player,active}:{player:LudoGameState["players"][number];active:boolean}) {
  const color = COLOR_HEX[player.color];
  const finished = player.tokens.filter(t => t.d === 58).length;
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl border bg-white/[.035] px-2 py-1.5 backdrop-blur-xl"
      style={{borderColor:active ? `${color}99` : "rgba(255,255,255,.08)",boxShadow:active ? `0 0 18px ${color}22` : undefined}}>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 text-[11px] font-black text-white"
        style={{borderColor:color,background:`linear-gradient(135deg,${color}88,#09090f)`}}>
        {(player.name ?? player.color).slice(0,1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-black">{player.name ?? player.color}</p>
        <p className="text-[8px] font-semibold text-white/40">{finished}/4 home</p>
      </div>
      {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />}
      <button type="button" className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/[.04]" aria-label={`Gift to ${player.name ?? player.color}`}>
        <Gift className="h-3.5 w-3.5" style={{color}} />
      </button>
    </div>
  );
}
