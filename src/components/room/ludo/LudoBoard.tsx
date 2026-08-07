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
  red: "from-red-600/95 to-red-800/95",
  blue: "from-blue-500/95 to-blue-800/95",
  green: "from-emerald-500/95 to-emerald-800/95",
  yellow: "from-amber-400/95 to-orange-600/95",
};

const TOKEN_RING: Record<LudoColor, string> = {
  red: "shadow-[0_0_14px_rgba(239,68,68,.7)]",
  blue: "shadow-[0_0_14px_rgba(59,130,246,.7)]",
  green: "shadow-[0_0_14px_rgba(34,197,94,.7)]",
  yellow: "shadow-[0_0_14px_rgba(234,179,8,.7)]",
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
  const current = state.players[state.turnIndex];
  const myTurn = myPlayerIndex === state.turnIndex;
  const DiceIcon =
    state.dice && state.dice >= 1 && state.dice <= 6
      ? DICE_ICONS[state.dice - 1]
      : Dice5;

  return (
    <div className="w-full max-w-[720px] mx-auto text-white">
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        {state.players.slice(0, 2).map((p, i) => (
          <PlayerCard
            key={p.color}
            player={p}
            active={state.turnIndex === i}
            avatar={p.userId ? avatarByUserId[p.userId] : undefined}
          />
        ))}
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[620px] overflow-hidden rounded-[24px] border border-cyan-300/40 bg-[#090615] p-2 shadow-[0_0_35px_rgba(40,180,255,.18),0_0_70px_rgba(140,50,255,.15)]">
        <div className="absolute inset-0 rounded-[24px] bg-[radial-gradient(circle_at_50%_50%,rgba(168,85,247,.14),transparent_42%)] pointer-events-none" />

        <div
          className="relative grid h-full w-full overflow-hidden rounded-[18px] border border-white/10 bg-[#11101b]"
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
          }}
        >
          {/* Four glossy yards */}
          {(["red", "blue", "green", "yellow"] as LudoColor[]).map((color) => {
            const player = state.players.find((p) => p.color === color);
            const yardTokens = player?.tokens.filter((t) => t.d === 0) ?? [];
            return (
              <div
                key={`yard-${color}`}
                className={`absolute z-[3] ${HOME_CLASS[color]} h-[42.85%] w-[42.85%] bg-gradient-to-br ${HOME_BG[color]} p-2.5`}
              >
                <div className="flex h-full w-full items-center justify-center rounded-[16px] border border-white/35 bg-white/80 shadow-inner">
                  <div className="grid grid-cols-2 gap-3 rounded-[14px] bg-white/70 p-4">
                    {[0, 1, 2, 3].map((slot) => {
                      const token = yardTokens[slot];
                      const tokenIndex = player?.tokens.findIndex((t) => t === token) ?? -1;
                      const canPick =
                        !!player &&
                        myTurn &&
                        myPlayerIndex === state.turnIndex &&
                        state.awaitingMove &&
                        state.players[state.turnIndex].color === color &&
                        tokenIndex >= 0;

                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={!canPick}
                          onClick={() => tokenIndex >= 0 && onPickToken(tokenIndex)}
                          className={`grid h-8 w-8 place-items-center rounded-full border-2 border-black/10 text-[9px] font-black text-white transition-transform ${
                            canPick ? "animate-pulse scale-110 ring-2 ring-white" : ""
                          } ${TOKEN_RING[color]}`}
                          style={{ backgroundColor: COLOR_HEX[color] }}
                        >
                          {token ? tokenIndex + 1 : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Shared ring */}
          {Array.from({ length: 52 }).map((_, i) => {
            const c = ringCellCoord(i);
            const safe = isSafeRingIndex(i);
            return (
              <div
                key={`ring-${i}`}
                className={`z-[1] border border-black/15 ${
                  safe
                    ? "bg-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.45)]"
                    : "bg-[#f7f4ec]"
                }`}
                style={{ gridRow: c.row + 1, gridColumn: c.col + 1 }}
              >
                {safe && (
                  <div className="grid h-full w-full place-items-center text-[10px] font-black text-slate-400">
                    ★
                  </div>
                )}
              </div>
            );
          })}

          {/* Home-stretch lanes */}
          {(["red", "blue", "yellow", "green"] as LudoColor[]).map((color) => {
            const player = state.players.find((p) => p.color === color);
            const cells = player ? player.tokens : [];
            const lane = cells.length ? tokenCoord : null;
            void lane;
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
                className="z-[2] border border-white/20"
                style={{
                  gridRow: c.row + 1,
                  gridColumn: c.col + 1,
                  backgroundColor: `${COLOR_HEX[color]}d9`,
                }}
              />
            ));
          })}

          {/* Center four-color finish */}
          <div className="absolute left-[42.85%] top-[42.85%] z-[4] h-[14.3%] w-[14.3%] overflow-hidden">
            <div className="absolute inset-0 bg-red-500" style={{ clipPath: "polygon(0 0,100% 0,50% 50%)" }} />
            <div className="absolute inset-0 bg-blue-500" style={{ clipPath: "polygon(100% 0,100% 100%,50% 50%)" }} />
            <div className="absolute inset-0 bg-yellow-500" style={{ clipPath: "polygon(100% 100%,0 100%,50% 50%)" }} />
            <div className="absolute inset-0 bg-green-500" style={{ clipPath: "polygon(0 100%,0 0,50% 50%)" }} />
            <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_14px_white]" />
          </div>

          {/* On-board tokens */}
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
                  className={`z-[20] grid place-items-center rounded-full border-2 border-white text-[9px] font-black text-white transition-all ${
                    canPick
                      ? "cursor-pointer animate-pulse scale-110 ring-2 ring-white"
                      : "cursor-default"
                  } ${TOKEN_RING[p.color]}`}
                  style={{
                    gridRow: coord.row + 1,
                    gridColumn: coord.col + 1,
                    margin: "2px",
                    background: `linear-gradient(145deg, ${COLOR_HEX[p.color]}, #111)`,
                  }}
                >
                  {tIdx + 1}
                </button>
              );
            }),
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mt-2.5">
        {state.players.slice(2, 4).map((p, i) => (
          <PlayerCard
            key={p.color}
            player={p}
            active={state.turnIndex === i + 2}
            avatar={p.userId ? avatarByUserId[p.userId] : undefined}
          />
        ))}
      </div>

      <div className="mt-2.5 flex items-center justify-center gap-3">
        <button
          type="button"
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold"
        >
          ↩ Undo
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={onRoll}
            disabled={!myTurn || state.awaitingMove || rolling || !!state.winnerIndex}
            className="grid h-20 w-20 place-items-center rounded-full border-2 border-fuchsia-400/70 bg-gradient-to-br from-white to-slate-200 text-slate-900 shadow-[0_0_25px_rgba(168,85,247,.7)] transition-transform active:scale-90 disabled:opacity-40"
            aria-label="Roll dice"
          >
            {rolling ? (
              <Loader2 className="h-8 w-8 animate-spin text-purple-700" />
            ) : (
              <DiceIcon className="h-9 w-9" />
            )}
          </button>
          <p className="mt-1 text-[11px] font-semibold text-white/70">
            {state.awaitingMove ? "Pick a token" : "Tap to Roll"}
          </p>
        </div>

        <button
          type="button"
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold"
        >
          ✦ Auto Move
        </button>
      </div>

      <div className="mt-2.5 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0b0918]/90 p-2.5">
        <div className="flex-1">
          <p className="text-xs font-extrabold">
            🎙 Voice <span className="text-emerald-400">Room Active</span>
          </p>
          <p className="text-[10px] text-white/55">You can talk while playing</p>
        </div>
        <button className="grid h-10 w-10 place-items-center rounded-full border border-emerald-400/50 bg-emerald-500/10 text-emerald-300">
          <Mic className="h-5 w-5" />
        </button>
        <button className="grid h-10 w-10 place-items-center rounded-full border border-cyan-400/40 bg-cyan-500/10 text-cyan-300">
          <Volume2 className="h-5 w-5" />
        </button>
        <button className="flex h-10 items-center gap-1 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 text-xs font-bold">
          <Smile className="h-4 w-4" /> Emoji
        </button>
        <button className="flex h-10 items-center gap-1 rounded-xl border border-red-400/40 bg-red-500/10 px-3 text-xs font-bold text-red-300">
          Exit Game
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
      className={`flex min-w-0 items-center gap-2 rounded-2xl border px-2.5 py-2 ${
        active ? "border-white/50 bg-white/10" : "border-white/10 bg-black/20"
      }`}
      style={{ borderColor: active ? COLOR_HEX[player.color] : undefined }}
    >
      {avatar ? (
        <img
          src={avatar}
          alt=""
          className="h-11 w-11 shrink-0 rounded-full border-2 object-cover"
          style={{ borderColor: COLOR_HEX[player.color] }}
        />
      ) : (
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 text-sm font-black"
          style={{ borderColor: COLOR_HEX[player.color], backgroundColor: `${COLOR_HEX[player.color]}44` }}
        >
          {(player.name ?? player.color).slice(0, 1).toUpperCase()}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold">{player.name ?? player.color}</p>
        <p className="text-[10px] text-white/60">🪙  {player.tokens.filter((t) => t.d === 58).length * 1000 + 7200}</p>
      </div>

      <Gift className="h-5 w-5 shrink-0" style={{ color: COLOR_HEX[player.color] }} />
    </div>
  );
}
