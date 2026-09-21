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
  tokens: LudoToken[];
};
export type LudoGameState = {
  mode: LudoMode;
  players: LudoPlayer[];
  turnIndex: number;
  dice: number | null;
  consecutiveSixes: number;
  awaitingMove: boolean;
  log: string[];
  winnerIndex: number | null;
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

export function getValidMoveTokens(
  state: LudoGameState,
  playerIndex: number,
  dice: number,
): number[] {
  const player = state.players[playerIndex];
  const out: number[] = [];
  player.tokens.forEach((t, i) => {
    if (t.d === 0) {
      if (dice === 6) out.push(i);
      return;
    }
    if (t.d === 58) return;
    if (t.d + dice <= 58) out.push(i);
  });
  return out;
}

function ringIndexFor(color: LudoColor, d: number): number | null {
  if (d < 1 || d > 51) return null;
  return (START_OFFSET[color] + d - 1) % 52;
}

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

  const extraTurn = dice === 6 || captured;
  next.dice = null;
  next.awaitingMove = false;
  if (extraTurn && state.consecutiveSixes < 3) {
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
    let score = toD;

    if (toD === 58) score += 1000;

    const myRing = ringIndexFor(player.color, toD);
    if (myRing !== null && !SAFE_RING_INDICES.includes(myRing)) {
      const capturesSomeone = state.players.some(
        (op, opIdx) =>
          opIdx !== playerIndex && op.tokens.some((ot) => ringIndexFor(op.color, ot.d) === myRing),
      );
      if (capturesSomeone) score += 500;
    }
    if (t.d === 0) score += 50;
    return { i, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].i;
}

export const GRID_SIZE = 15;

const TRACK_COORDS: { row: number; col: number }[] = [
  { row: 6, col: 1 }, { row: 6, col: 2 }, { row: 6, col: 3 }, { row: 6, col: 4 }, { row: 6, col: 5 },
  { row: 5, col: 6 }, { row: 4, col: 6 }, { row: 3, col: 6 }, { row: 2, col: 6 }, { row: 1, col: 6 }, { row: 0, col: 6 },
  { row: 0, col: 7 },
  { row: 1, col: 7 }, { row: 2, col: 7 }, { row: 3, col: 7 }, { row: 4, col: 7 }, { row: 5, col: 7 },
  { row: 6, col: 8 },
  { row: 6, col: 9 }, { row: 6, col: 10 }, { row: 6, col: 11 }, { row: 6, col: 12 }, { row: 6, col: 13 }, { row: 6, col: 14 },
  { row: 7, col: 14 }, { row: 8, col: 14 },
  { row: 8, col: 13 }, { row: 8, col: 12 }, { row: 8, col: 11 }, { row: 8, col: 10 }, { row: 8, col: 9 }, { row: 8, col: 8 },
  { row: 9, col: 7 }, { row: 10, col: 7 }, { row: 11, col: 7 }, { row: 12, col: 7 }, { row: 13, col: 7 }, { row: 14, col: 7 },
  { row: 14, col: 6 },
  { row: 13, col: 6 }, { row: 12, col: 6 }, { row: 11, col: 6 }, { row: 10, col: 6 }, { row: 9, col: 6 },
  { row: 8, col: 5 },
  { row: 8, col: 4 }, { row: 8, col: 3 }, { row: 8, col: 2 }, { row: 8, col: 1 }, { row: 8, col: 0 },
  { row: 7, col: 0 }, { row: 6, col: 0 },
];

export function ringCellCoord(idx: number): { row: number; col: number } {
  return TRACK_COORDS[((idx % 52) + 52) % 52];
}

const HOME_STRETCH: Record<LudoColor, { row: number; col: number }[]> = {
  red: [1, 2, 3, 4, 5, 6].map((col) => ({ row: 7, col })),
  green: [1, 2, 3, 4, 5, 6].map((row) => ({ row, col: 7 })),
  yellow: [13, 12, 11, 10, 9, 8].map((col) => ({ row: 7, col })),
  blue: [13, 12, 11, 10, 9, 8].map((row) => ({ row, col: 7 })),
};
const FINISH_SPOT: Record<LudoColor, { row: number; col: number }> = {
  red: { row: 6, col: 6 },
  green: { row: 6, col: 7 },
  yellow: { row: 7, col: 7 },
  blue: { row: 7, col: 6 },
};

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
