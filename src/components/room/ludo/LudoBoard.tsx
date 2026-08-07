import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, Loader2 } from "lucide-react";
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

export function LudoBoard({
  state,
  myPlayerIndex,
  rolling,
  onRoll,
  onPickToken,
}: {
  state: LudoGameState;
  /** index into state.players for the local human viewing this board, or
   *  null when just spectating (e.g. mid-lobby preview). */
  myPlayerIndex: number | null;
  rolling: boolean;
  onRoll: () => void;
  onPickToken: (tokenIndex: number) => void;
}) {
  const current = state.players[state.turnIndex];
  const myTurn = myPlayerIndex === state.turnIndex;
  const DiceIcon = state.dice ? DICE_ICONS[state.dice - 1] : Dice1;

  const cells: { row: number; col: number; safe: boolean }[] = [];
  for (let i = 0; i < 52; i++) {
    const c = ringCellCoord(i);
    cells.push({ ...c, safe: isSafeRingIndex(i) });
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative aspect-square w-full max-w-[380px] rounded-2xl border border-white/10 bg-background/60 p-1"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
        }}
      >
        {/* shared ring path cells */}
        {cells.map((c, i) => (
          <div
            key={`ring-${i}`}
            className={`rounded-[3px] border ${c.safe ? "border-[color:var(--gold)]/60 bg-[color:var(--gold)]/10" : "border-white/5 bg-white/5"}`}
            style={{ gridRow: c.row + 1, gridColumn: c.col + 1 }}
          />
        ))}

        {/* center home triangle */}
        <div
          className="glow-4d rounded-lg bg-gradient-to-br from-white/10 to-white/0"
          style={{ gridRow: "7 / 9", gridColumn: "7 / 9" }}
        />

        {/* yard boxes, one per active color, top-left/top-right/bottom-right/bottom-left */}
        {state.players.map((p) => (
          <YardBox key={p.color} color={p.color} />
        ))}

        {/* tokens on the board (ring / home-stretch / finished) */}
        {state.players.flatMap((p, pIdx) =>
          p.tokens.map((t, tIdx) => {
            const coord = tokenCoord(p.color, t.d);
            if (!coord) return null;
            const canPick = myTurn && myPlayerIndex === pIdx && state.awaitingMove;
            return (
              <button
                key={`${p.color}-${tIdx}`}
                disabled={!canPick}
                onClick={() => onPickToken(tIdx)}
                className={`z-10 grid place-items-center rounded-full border-2 border-white/70 text-[9px] font-black text-white shadow transition-transform ${
                  canPick ? "cursor-pointer animate-pulse ring-2 ring-white" : "cursor-default"
                }`}
                style={{
                  gridRow: coord.row + 1,
                  gridColumn: coord.col + 1,
                  background: COLOR_HEX[p.color],
                  margin: 2,
                }}
              >
                {tIdx + 1}
              </button>
            );
          }),
        )}
      </div>

      {/* yard tokens (still off-board) rendered as overlay dots inside each corner */}
      <div className="grid w-full max-w-[380px] grid-cols-4 gap-2">
        {state.players.map((p, pIdx) => {
          const yardCount = p.tokens.filter((t) => t.d === 0).length;
          const finishedCount = p.tokens.filter((t) => t.d === 58).length;
          return (
            <div
              key={p.color}
              className={`rounded-xl border p-2 text-center ${
                state.turnIndex === pIdx
                  ? "border-white/60 bg-white/10"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <div
                className="mx-auto mb-1 h-3 w-3 rounded-full"
                style={{ background: COLOR_HEX[p.color] }}
              />
              <p className="truncate text-[10px] font-bold">{p.name ?? p.color}</p>
              <p className="text-[9px] text-muted-foreground">
                {yardCount > 0 ? `${yardCount} in yard` : `${finishedCount}/4 home`}
              </p>
            </div>
          );
        })}
      </div>

      {/* turn indicator + dice */}
      <div className="flex w-full items-center justify-between rounded-2xl border border-border bg-background/60 p-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: COLOR_HEX[current.color] }} />
          <p className="text-xs font-bold">
            {myTurn ? "Your turn" : `${current.name ?? current.color}'s turn`}
            {current.kind === "bot" && !myTurn ? " (computer)" : ""}
          </p>
        </div>
        <button
          onClick={onRoll}
          disabled={!myTurn || state.awaitingMove || rolling || !!state.winnerIndex}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] px-4 py-2 text-xs font-extrabold text-primary-foreground disabled:opacity-40"
        >
          {rolling ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <DiceIcon className="h-4 w-4" />
          )}
          {state.awaitingMove ? "Pick a token" : "Roll dice"}
        </button>
      </div>

      {state.log.length > 0 && (
        <p className="w-full truncate text-center text-[10px] text-muted-foreground">
          {state.log[state.log.length - 1]}
        </p>
      )}
    </div>
  );
}

/** A colored corner box that visually anchors where each color's yard sits.
 *  Purely decorative — actual yard-token counts render in the strip below
 *  the board (keeps the grid math simple and collision-free). */
function YardBox({ color }: { color: LudoColor }) {
  const pos: Record<LudoColor, { row: string; col: string }> = {
    red: { row: "1 / 4", col: "1 / 4" },
    green: { row: "1 / 4", col: "11 / 14" },
    yellow: { row: "11 / 14", col: "11 / 14" },
    blue: { row: "11 / 14", col: "1 / 4" },
  };
  const p = pos[color];
  return (
    <div
      className="rounded-lg border-2 opacity-70"
      style={{
        gridRow: p.row,
        gridColumn: p.col,
        borderColor: COLOR_HEX[color],
        background: `${COLOR_HEX[color]}22`,
      }}
    />
  );
}
