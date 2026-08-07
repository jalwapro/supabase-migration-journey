/**
 * ludoEngine.ts
 * -------------
 * Self-contained Ludo game engine — pure functions + types, no React, no
 * network. Supports:
 *   - "2p"  — 2 seats (Red vs Yellow), solo-vs-computer or 1v1 with a friend
 *   - "4p"  — 4 seats (Red, Green, Yellow, Blue), free-for-all
 *   - "2v2" — 4 seats, teamed diagonally (Red+Yellow vs Green+Blue)
 *
 * Board model: the 52-cell shared ring is walked as the border of a 14x14
 * grid (top row, right col, bottom row, left col — 14+13+13+12 = 52 cells).
 * Each color's start offset is a corner of that ring, spaced 13 apart, which
 * keeps the math simple while still giving a proper 4-corner Ludo layout.
 *
 * Per-token progress `d`:
 *   0        → sitting in the yard (not on the board yet)
 *   1 - 51   → position on the 52-cell shared ring (relative to own start)
 *   52 - 57  → own private home-stretch (6 cells, no other color can land here)
 *   58       → finished (home)
 */

export type LudoColor = "red" | "green" | "yellow" | "blue";
export type SeatKind = "human" | "bot" | "empty";
export type LudoMode = "2p" | "4p" | "2v2";

export const COLOR_ORDER: LudoColor[] = ["red", "green", "yellow", "blue"];
export const COLOR_HEX: Record<LudoColor, string> = {
  red: "#ef4444",
  green: "#22c55e",
  yellow: "#eab308",
  blue: "#3b82f6",
};
export const START_OFFSET: Record<LudoColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};
/** Safe cells (can't be captured while sitting here): every color's own
 *  entry cell, plus one "star" cell 8 steps after it — 8 safe cells total. */
export const SAFE_RING_INDICES: number[] = COLOR_ORDER.flatMap((c) => [
  START_OFFSET[c] % 52,
  (START_OFFSET[c] + 8) % 52,
]);

export type LudoToken = { d: number };
export type LudoPlayer = {
  color: LudoColor;
  kind: SeatKind;
  userId?: string;
  name?: string;
  tokens: LudoToken[]; // always length 4
};
export type LudoGameState = {
  mode: LudoMode;
  players: LudoPlayer[]; // active seats only, ordered by COLOR_ORDER
  turnIndex: number; // index into players[]
  dice: number | null;
  consecutiveSixes: number;
  awaitingMove: boolean; // true once dice rolled and a move is required
  log: string[];
  winnerIndex: number | null; // index into players[], set once game ends
  winningTeam: "A" | "B" | null;
  teamOf?: Partial<Record<LudoColor, "A" | "B">>;
};

const TEAM_OF_2V2: Record<LudoColor, "A" | "B"> = {
  red: "A",
  yellow: "A",
  green: "B",
  blue: "B",
};

export function activeColorsForMode(mode: LudoMode): LudoColor[] {
  if (mode === "2p") return ["red", "yellow"];
  return ["red", "green", "yellow", "blue"];
}

export function createGame(
  mode: LudoMode,
  seatInputs: { color: LudoColor; kind: SeatKind; userId?: string; name?: string }[],
): LudoGameState {
  const colors = activeColorsForMode(mode);
  const players: LudoPlayer[] = colors.map((color) => {
    const seat = seatInputs.find((s) => s.color === color);
    return {
      color,
      kind: seat?.kind ?? "bot",
      userId: seat?.userId,
      name: seat?.name,
      tokens: [{ d: 0 }, { d: 0 }, { d: 0 }, { d: 0 }],
    };
  });
  return {
    mode,
    players,
    turnIndex: 0,
    dice: null,
    consecutiveSixes: 0,
    awaitingMove: false,
    log: [`${players[0].name ?? players[0].color} rolls first.`],
    winnerIndex: null,
    winningTeam: null,
    teamOf: mode === "2v2" ? TEAM_OF_2V2 : undefined,
  };
}

export function rollDice(): number {
  return 1 + Math.floor(Math.random() * 6);
}

/** Token indices (0-3) belonging to `player` that can legally move `dice` steps. */
export function getValidMoveTokens(
  state: LudoGameState,
  playerIndex: number,
  dice: number,
): number[] {
  const player = state.players[playerIndex];
  const out: number[] = [];
  player.tokens.forEach((t, i) => {
    if (t.d === 0) {
      if (dice === 6) out.push(i); // enter the board
      return;
    }
    if (t.d === 58) return; // already finished
    if (t.d + dice <= 58) out.push(i);
  });
  return out;
}

function ringIndexFor(color: LudoColor, d: number): number | null {
  if (d < 1 || d > 51) return null;
  return (START_OFFSET[color] + d - 1) % 52;
}

/** Apply moving `tokenIndex` of the current player by the rolled dice. Mutates
 *  a shallow copy and returns the new state (capture / finish / extra-turn
 *  logic all happens here). */
export function applyMove(state: LudoGameState, tokenIndex: number): LudoGameState {
  const dice = state.dice ?? 0;
  const playerIndex = state.turnIndex;
  const players = state.players.map((p) => ({ ...p, tokens: p.tokens.map((t) => ({ ...t })) }));
  const player = players[playerIndex];
  const token = player.tokens[tokenIndex];
  const log = [...state.log];

  const fromD = token.d;
  const toD = fromD === 0 ? 1 : fromD + dice;
  token.d = toD;

  if (fromD === 0) {
    log.push(`${player.name ?? player.color} entered a token.`);
  }

  // Capture check — only on the shared ring, and only on non-safe cells.
  const myRing = ringIndexFor(player.color, toD);
  let captured = false;
  if (myRing !== null && !SAFE_RING_INDICES.includes(myRing)) {
    players.forEach((op, opIdx) => {
      if (opIdx === playerIndex) return;
      op.tokens.forEach((ot) => {
        const opRing = ringIndexFor(op.color, ot.d);
        if (opRing !== null && opRing === myRing) {
          ot.d = 0;
          captured = true;
          log.push(`${player.name ?? player.color} captured ${op.name ?? op.color}'s token!`);
        }
      });
    });
  }

  if (toD === 58) {
    log.push(`${player.name ?? player.color} brought a token home!`);
  }

  const finishedAll = player.tokens.every((t) => t.d === 58);

  let next: LudoGameState = {
    ...state,
    players,
    log,
  };

  if (finishedAll) {
    if (state.mode === "2v2") {
      const team = state.teamOf?.[player.color] ?? null;
      next = { ...next, winningTeam: team, winnerIndex: playerIndex };
      log.push(`Team ${team} wins! 🏆`);
    } else {
      next = { ...next, winnerIndex: playerIndex };
      log.push(`${player.name ?? player.color} wins! 🏆`);
    }
    next.awaitingMove = false;
    return next;
  }

  // Extra turn on 6 or on a capture; otherwise pass to next player.
  const extraTurn = dice === 6 || captured;
  next.dice = null;
  next.awaitingMove = false;
  if (extraTurn && state.consecutiveSixes < 3) {
    // same player rolls again
    next.turnIndex = playerIndex;
  } else {
    next.turnIndex = nextTurnIndex(state, playerIndex);
    next.consecutiveSixes = 0;
  }
  return next;
}

function nextTurnIndex(state: LudoGameState, from: number): number {
  return (from + 1) % state.players.length;
}

/** Called right after a dice roll. If the current player has no legal move,
 *  the turn is skipped automatically and this returns the state fully
 *  advanced; otherwise it just records the dice + awaitingMove=true. */
export function applyRoll(state: LudoGameState, dice: number): LudoGameState {
  const playerIndex = state.turnIndex;
  const consecutiveSixes = dice === 6 ? state.consecutiveSixes + 1 : 0;
  const log = [
    ...state.log,
    `${state.players[playerIndex].name ?? state.players[playerIndex].color} rolled a ${dice}.`,
  ];

  if (dice === 6 && consecutiveSixes >= 3) {
    log.push("Three 6s in a row — turn forfeited.");
    return {
      ...state,
      dice,
      consecutiveSixes: 0,
      awaitingMove: false,
      turnIndex: nextTurnIndex(state, playerIndex),
      log,
    };
  }

  const valid = getValidMoveTokens(state, playerIndex, dice);
  if (valid.length === 0) {
    log.push("No valid move — turn passes.");
    return {
      ...state,
      dice,
      consecutiveSixes,
      awaitingMove: false,
      turnIndex: dice === 6 ? playerIndex : nextTurnIndex(state, playerIndex),
      log,
    };
  }

  return { ...state, dice, consecutiveSixes, awaitingMove: true, log };
}

/** Simple heuristic bot: prefer captures, then finishing a token, then
 *  moving the token that's furthest along, then entering from the yard. */
export function botChooseToken(
  state: LudoGameState,
  playerIndex: number,
  dice: number,
): number | null {
  const valid = getValidMoveTokens(state, playerIndex, dice);
  if (valid.length === 0) return null;
  const player = state.players[playerIndex];

  const scored = valid.map((i) => {
    const t = player.tokens[i];
    const toD = t.d === 0 ? 1 : t.d + dice;
    let score = toD; // prefer furthest progress by default

    if (toD === 58) score += 1000; // finishing is great

    const myRing = ringIndexFor(player.color, toD);
    if (myRing !== null && !SAFE_RING_INDICES.includes(myRing)) {
      const capturesSomeone = state.players.some(
        (op, opIdx) =>
          opIdx !== playerIndex && op.tokens.some((ot) => ringIndexFor(op.color, ot.d) === myRing),
      );
      if (capturesSomeone) score += 500; // capturing is even better
    }
    if (t.d === 0) score += 50; // getting a token out of the yard is good
    return { i, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].i;
}

// ---------------------------------------------------------------------------
// Board coordinate helpers (for rendering) — 14x14 grid, ring is the border.
// ---------------------------------------------------------------------------

export const GRID_SIZE = 14;

export function ringCellCoord(idx: number): { row: number; col: number } {
  const i = ((idx % 52) + 52) % 52;
  if (i <= 13) return { row: 0, col: i }; // top row
  if (i <= 26) return { row: i - 13, col: 13 }; // right col
  if (i <= 39) return { row: 13, col: 39 - i }; // bottom row
  return { row: 52 - i, col: 0 }; // left col
}

/** Diagonal home-stretch lane (6 cells) for each color, converging near the
 *  grid's center — purely a visual path, not part of the shared ring. */
const HOME_STRETCH: Record<LudoColor, { row: number; col: number }[]> = {
  red: [1, 2, 3, 4, 5, 6].map((n) => ({ row: n, col: n })),
  green: [1, 2, 3, 4, 5, 6].map((n) => ({ row: n, col: 13 - n })),
  yellow: [1, 2, 3, 4, 5, 6].map((n) => ({ row: 12 - n, col: 12 - n })),
  blue: [1, 2, 3, 4, 5, 6].map((n) => ({ row: 12 - n, col: 1 + n })),
};

/** Center resting spot for finished tokens of each color (slightly offset so
 *  all 4 colors' finished tokens are visible at once). */
const FINISH_SPOT: Record<LudoColor, { row: number; col: number }> = {
  red: { row: 6, col: 6 },
  green: { row: 6, col: 7 },
  yellow: { row: 7, col: 7 },
  blue: { row: 7, col: 6 },
};

/** Pixel-independent grid coordinate (row, col in a 14x14 grid) for a token
 *  given its color + progress `d`. Returns null for `d === 0` (yard —
 *  rendered separately, in the color's yard box). */
export function tokenCoord(color: LudoColor, d: number): { row: number; col: number } | null {
  if (d === 0) return null;
  if (d === 58) return FINISH_SPOT[color];
  if (d >= 52) return HOME_STRETCH[color][d - 52];
  const ring = ringIndexFor(color, d);
  if (ring === null) return null;
  return ringCellCoord(ring);
}

export function isSafeRingIndex(idx: number): boolean {
  return SAFE_RING_INDICES.includes(((idx % 52) + 52) % 52);
}