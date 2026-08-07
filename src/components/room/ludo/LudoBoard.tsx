import {
  Dice1,
  Dice2,
  Dice3,
  Dice4,
  Dice5,
  Dice6,
  Loader2,
} from "lucide-react";

import {
  COLOR_HEX,
  ringCellCoord,
  tokenCoord,
  type LudoColor,
  type LudoGameState,
} from "@/lib/ludoEngine";

const DICE_ICONS = [
  Dice1,
  Dice2,
  Dice3,
  Dice4,
  Dice5,
  Dice6,
];

const HOME_POSITIONS: Record<
  LudoColor,
  { row: number; col: number }
> = {
  red: { row: 1, col: 1 },
  green: { row: 1, col: 11 },
  blue: { row: 11, col: 1 },
  yellow: { row: 11, col: 11 },
};

export function LudoBoard({
  state,
  myPlayerIndex,
  rolling,
  onRoll,
  onPickToken,
}: {
  state: LudoGameState;
  myPlayerIndex: number | null;
  rolling: boolean;
  onRoll: () => void;
  onPickToken: (tokenIndex: number) => void;
}) {
  const current = state.players[state.turnIndex];

  const myTurn =
    myPlayerIndex !== null &&
    myPlayerIndex === state.turnIndex;

  const DiceIcon =
    state.dice && state.dice >= 1 && state.dice <= 6
      ? DICE_ICONS[state.dice - 1]
      : Dice1;

  return (
    <div className="w-full max-w-[390px] mx-auto space-y-3">

      {/* =========================
          PLAYER HEADER
      ========================== */}
      <div className="grid grid-cols-2 gap-2">

        {state.players.slice(0, 2).map((player, index) => (
          <PlayerCard
            key={player.color}
            player={player}
            active={state.turnIndex === index}
          />
        ))}

      </div>

      {/* =========================
          LUDO BOARD
      ========================== */}
      <div
        className="
          relative
          aspect-square
          w-full
          overflow-hidden
          rounded-[24px]
          border
          border-white/15
          bg-[#080612]
          p-2
          shadow-[0_0_50px_rgba(130,50,255,0.25)]
        "
      >

        {/* OUTER GLOW */}
        <div className="
          pointer-events-none
          absolute inset-0
          rounded-[24px]
          ring-1 ring-purple-400/20
        " />

        {/* 15 x 15 BOARD */}
        <div
          className="relative grid h-full w-full overflow-hidden rounded-[18px]"
          style={{
            gridTemplateColumns: "repeat(15, minmax(0, 1fr))",
            gridTemplateRows: "repeat(15, minmax(0, 1fr))",
          }}
        >

          {/* =========================
              RED HOME
          ========================== */}
          <HomeArea
            color="red"
            className="row-start-1 col-start-1 row-span-6 col-span-6"
          />

          {/* =========================
              GREEN HOME
          ========================== */}
          <HomeArea
            color="green"
            className="row-start-1 col-start-10 row-span-6 col-span-6"
          />

          {/* =========================
              BLUE HOME
          ========================== */}
          <HomeArea
            color="blue"
            className="row-start-10 col-start-1 row-span-6 col-span-6"
          />

          {/* =========================
              YELLOW HOME
          ========================== */}
          <HomeArea
            color="yellow"
            className="row-start-10 col-start-10 row-span-6 col-span-6"
          />

          {/* =========================
              PATH CELLS
          ========================== */}
          {Array.from({ length: 52 }).map((_, index) => {
            const coord = ringCellCoord(index);

            return (
              <div
                key={`path-${index}`}
                className="
                  z-[2]
                  border
                  border-white/10
                  bg-white/[0.045]
                  transition-colors
                "
                style={{
                  gridRow: coord.row + 1,
                  gridColumn: coord.col + 1,
                }}
              />
            );
          })}

          {/* =========================
              CENTER HOME
          ========================== */}
          <div
            className="
              relative
              z-[4]
              col-start-7
              row-start-7
              row-span-2
              col-span-2
              overflow-hidden
              bg-white/10
            "
          >

            {/* RED TRIANGLE */}
            <div
              className="
                absolute
                inset-0
                bg-red-500
              "
              style={{
                clipPath: "polygon(0 0, 100% 0, 50% 50%)",
              }}
            />

            {/* GREEN TRIANGLE */}
            <div
              className="
                absolute
                inset-0
                bg-green-500
              "
              style={{
                clipPath: "polygon(0 0, 50% 50%, 0 100%)",
              }}
            />

            {/* YELLOW TRIANGLE */}
            <div
              className="
                absolute
                inset-0
                bg-yellow-500
              "
              style={{
                clipPath: "polygon(100% 0, 100% 100%, 50% 50%)",
              }}
            />

            {/* BLUE TRIANGLE */}
            <div
              className="
                absolute
                inset-0
                bg-blue-500
              "
              style={{
                clipPath: "polygon(0 100%, 100% 100%, 50% 50%)",
              }}
            />

            {/* CENTER */}
            <div
              className="
                absolute
                left-1/2
                top-1/2
                h-3
                w-3
                -translate-x-1/2
                -translate-y-1/2
                rounded-full
                bg-white
                shadow-[0_0_12px_white]
              "
            />

          </div>

          {/* =========================
              TOKENS
          ========================== */}
          {state.players.flatMap((player, playerIndex) =>
            player.tokens.map((token, tokenIndex) => {

              const coord = tokenCoord(
                player.color,
                token.d
              );

              if (!coord) return null;

              const canPick =
                myTurn &&
                myPlayerIndex === playerIndex &&
                state.awaitingMove;

              return (
                <button
                  key={`${player.color}-${tokenIndex}`}
                  type="button"
                  disabled={!canPick}
                  onClick={() =>
                    onPickToken(tokenIndex)
                  }
                  className={`
                    z-[20]
                    flex
                    items-center
                    justify-center
                    rounded-full
                    border-2
                    border-white
                    text-[9px]
                    font-black
                    text-white
                    shadow-[0_4px_12px_rgba(0,0,0,.5)]
                    transition-all
                    ${
                      canPick
                        ? `
                          cursor-pointer
                          scale-110
                          animate-pulse
                          ring-2
                          ring-white
                          ring-offset-2
                          ring-offset-transparent
                        `
                        : "cursor-default"
                    }
                  `}
                  style={{
                    gridRow: coord.row + 1,
                    gridColumn: coord.col + 1,
                    backgroundColor:
                      COLOR_HEX[player.color],
                    margin: "3px",
                  }}
                >
                  {tokenIndex + 1}
                </button>
              );
            })
          )}

        </div>
      </div>

      {/* =========================
          BOTTOM PLAYERS
      ========================== */}
      <div className="grid grid-cols-2 gap-2">

        {state.players.slice(2, 4).map((player, index) => (
          <PlayerCard
            key={player.color}
            player={player}
            active={
              state.turnIndex === index + 2
            }
          />
        ))}

      </div>

      {/* =========================
          DICE CONTROL
      ========================== */}
      <div
        className="
          flex
          items-center
          justify-between
          rounded-2xl
          border
          border-white/10
          bg-black/30
          p-3
        "
      >

        <div className="flex items-center gap-2">

          <span
            className="h-3 w-3 rounded-full"
            style={{
              backgroundColor:
                COLOR_HEX[current.color],
            }}
          />

          <div>
            <p className="text-xs font-bold">
              {myTurn
                ? "Your turn"
                : `${current.name ?? current.color}'s turn`}
            </p>

            {state.awaitingMove && (
              <p className="text-[10px] text-white/50">
                Pick a token
              </p>
            )}
          </div>

        </div>

        {/* DICE */}
        <button
          type="button"
          onClick={onRoll}
          disabled={
            !myTurn ||
            state.awaitingMove ||
            rolling ||
            !!state.winnerIndex
          }
          className="
            flex
            h-14
            w-14
            items-center
            justify-center
            rounded-full
            border
            border-purple-400/60
            bg-gradient-to-br
            from-purple-500
            to-indigo-700
            shadow-[0_0_25px_rgba(140,70,255,.5)]
            transition-all
            active:scale-90
            disabled:opacity-40
          "
        >

          {rolling ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <DiceIcon className="h-7 w-7" />
          )}

        </button>

        <span className="text-[10px] text-white/50">
          {state.awaitingMove
            ? "Pick"
            : "Tap to Roll"}
        </span>

      </div>

      {/* =========================
          VOICE ROOM STATUS
      ========================== */}
      <div
        className="
          flex
          items-center
          justify-between
          rounded-2xl
          border
          border-white/10
          bg-black/30
          px-4
          py-3
        "
      >

        <div>
          <p className="text-xs font-bold">
            🎙️ Voice Room Active
          </p>

          <p className="text-[10px] text-white/50">
            You can talk while playing
          </p>
        </div>

        <div className="flex gap-2">

          <button
            className="
              h-10
              w-10
              rounded-full
              border
              border-green-400/40
              bg-green-500/10
              text-green-400
            "
          >
            🎙️
          </button>

          <button
            className="
              h-10
              w-10
              rounded-full
              border
              border-white/10
              bg-white/5
            "
          >
            🔊
          </button>

        </div>

      </div>

      {/* LOG */}
      {state.log.length > 0 && (
        <p className="truncate text-center text-[10px] text-white/40">
          {state.log[state.log.length - 1]}
        </p>
      )}

    </div>
  );
}


/* =====================================================
   HOME AREA
===================================================== */

function HomeArea({
  color,
  className,
}: {
  color: LudoColor;
  className: string;
}) {
  const colorClass: Record<LudoColor, string> = {
    red: "bg-red-600",
    green: "bg-green-600",
    blue: "bg-blue-600",
    yellow: "bg-yellow-500",
  };

  const innerClass: Record<LudoColor, string> = {
    red: "bg-red-100",
    green: "bg-green-100",
    blue: "bg-blue-100",
    yellow: "bg-yellow-100",
  };

  return (
    <div
      className={`
        relative
        z-[1]
        ${className}
        ${colorClass[color]}
        p-2
      `}
    >

      <div
        className={`
          flex
          h-full
          w-full
          items-center
          justify-center
          rounded-xl
          ${innerClass[color]}
        `}
      >

        <div className="grid grid-cols-2 gap-3">

          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`
                h-6
                w-6
                rounded-full
                border-2
                border-black/10
                shadow-inner
                ${
                  color === "red"
                    ? "bg-red-500/80"
                    : color === "green"
                    ? "bg-green-500/80"
                    : color === "blue"
                    ? "bg-blue-500/80"
                    : "bg-yellow-500/80"
                }
              `}
            />
          ))}

        </div>

      </div>

    </div>
  );
}


/* =====================================================
   PLAYER CARD
===================================================== */

function PlayerCard({
  player,
  active,
}: {
  player: any;
  active: boolean;
}) {
  return (
    <div
      className={`
        flex
        items-center
        gap-2
        rounded-xl
        border
        px-3
        py-2
        ${
          active
            ? "border-purple-400/70 bg-purple-500/10"
            : "border-white/10 bg-black/20"
        }
      `}
    >

      <div
        className="h-8 w-8 rounded-full border-2"
        style={{
          borderColor:
            COLOR_HEX[player.color],
          background:
            COLOR_HEX[player.color],
          boxShadow: active
            ? `0 0 12px ${COLOR_HEX[player.color]}`
            : "none",
        }}
      />

      <div className="min-w-0">

        <p className="truncate text-xs font-bold">
          {player.name ?? player.color}
        </p>

        <p className="text-[9px] text-white/50">
          {player.tokens?.filter(
            (t: any) => t.d === 58
          ).length ?? 0}
          /4 Home
        </p>

      </div>

    </div>
  );
}
